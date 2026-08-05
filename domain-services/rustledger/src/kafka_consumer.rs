use futures::StreamExt;
use rskafka::client::consumer::{StartOffset, StreamConsumerBuilder};
use rskafka::client::partition::UnknownTopicHandling;
use rskafka::client::ClientBuilder;
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::sleep;

use crate::billing::{bill_stopped_session, RateCard};
use crate::models::SessionEvent;

const TOPIC: &str = "elixtempo.sessions";

pub async fn run(brokers: Vec<String>, pool: PgPool) {
    let rate_card = RateCard::from_env();

    // Elixtempo may not have produced anything yet (topic doesn't exist),
    // or the broker may still be starting up — retry until we're connected
    // and the topic is there, instead of crashing on startup ordering.
    let client = loop {
        match ClientBuilder::new(brokers.clone()).build().await {
            Ok(client) => break client,
            Err(err) => {
                tracing::warn!(?err, "kafka not reachable yet, retrying in 5s");
                sleep(Duration::from_secs(5)).await;
            }
        }
    };

    ensure_topic(&client).await;

    let partition_client = loop {
        match client
            .partition_client(TOPIC, 0, UnknownTopicHandling::Error)
            .await
        {
            Ok(pc) => break pc,
            Err(err) => {
                tracing::warn!(?err, "topic not ready yet, retrying in 5s");
                sleep(Duration::from_secs(5)).await;
            }
        }
    };

    let mut stream = StreamConsumerBuilder::new(partition_client.into(), StartOffset::Earliest)
        .with_max_wait_ms(1_000)
        .build();

    tracing::info!(topic = TOPIC, "listening for session events");

    while let Some(result) = stream.next().await {
        let (record, _high_watermark) = match result {
            Ok(r) => r,
            Err(err) => {
                tracing::error!(?err, "error consuming from kafka");
                continue;
            }
        };

        let Some(value) = record.record.value else {
            continue;
        };

        let event: SessionEvent = match serde_json::from_slice(&value) {
            Ok(e) => e,
            Err(err) => {
                tracing::error!(?err, "failed to parse session event, skipping");
                continue;
            }
        };

        if event.event != "session.stopped" {
            continue;
        }

        if let Err(err) = bill_stopped_session(&pool, &rate_card, &event).await {
            tracing::error!(?err, session_id = %event.session_id, "failed to bill session");
        }
    }
}

async fn ensure_topic(client: &rskafka::client::Client) {
    let controller = match client.controller_client() {
        Ok(c) => c,
        Err(err) => {
            tracing::warn!(?err, "could not get controller client to create topic");
            return;
        }
    };

    match controller
        .create_topic(TOPIC, 1, 1, 5_000)
        .await
    {
        Ok(_) => tracing::info!(topic = TOPIC, "created topic"),
        Err(err) => {
            // already exists is fine — anything else just gets logged, the
            // partition_client retry loop above will keep trying anyway
            tracing::debug!(?err, "create_topic returned (likely already exists)");
        }
    }
}
