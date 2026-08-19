use chrono::Utc;
use rskafka::client::partition::{Compression, PartitionClient, UnknownTopicHandling};
use rskafka::client::ClientBuilder;
use rskafka::record::Record;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;
use tokio::time::sleep;

use crate::models::Bill;

const TOPIC: &str = "rustledger.bills";

// Shared handle installed once the background connect (spawn_connect
// below) finishes — empty until then. A OnceCell rather than a bare
// PartitionClient in AppState specifically so main() never blocks
// axum::serve on Kafka being reachable (see spawn_connect's comment).
pub type Producer = Arc<OnceCell<PartitionClient>>;

// rustledger's first-ever Kafka *producer* (kafka_consumer.rs only ever
// consumes, from elixtempo.sessions) — producer-owns-its-topic, same
// convention as task-service's kafka-producer.js. Was billing-service.bills
// when a separate Node billing-service existed as the Stripe-facing layer;
// renamed now that rustledger owns that role directly. task-service's own
// consumer (events/kafka-consumer.js) just needed its TOPIC constant
// updated to match.
//
// Connects in the background rather than being awaited in main() before
// axum::serve starts — kafka_consumer::run has the same retry-until-
// connected shape but runs inside its own tokio::spawn already, so a
// slow/unreachable Kafka never blocked HTTP serving for it; this mirrors
// that rather than adding a new startup-blocking dependency for routes
// (bill CRUD, line-items) that don't touch Kafka at all.
pub fn spawn_connect(brokers: Vec<String>) -> Producer {
    let producer: Producer = Arc::new(OnceCell::new());
    let handle = producer.clone();
    tokio::spawn(async move {
        let partition_client = connect(brokers).await;
        // Only ever set once, from this one task — .set() failing here
        // would mean a logic error, not a runtime condition to handle.
        let _ = handle.set(partition_client);
    });
    producer
}

async fn connect(brokers: Vec<String>) -> PartitionClient {
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

    loop {
        match client
            .partition_client(TOPIC, 0, UnknownTopicHandling::Error)
            .await
        {
            Ok(pc) => return pc,
            Err(err) => {
                tracing::warn!(?err, "topic not ready yet, retrying in 5s");
                sleep(Duration::from_secs(5)).await;
            }
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

    match controller.create_topic(TOPIC, 1, 1, 5_000).await {
        Ok(_) => tracing::info!(topic = TOPIC, "created topic"),
        Err(err) => {
            tracing::debug!(?err, "create_topic returned (likely already exists)");
        }
    }
}

// Best-effort — same posture as every producer in this stack (task-
// service's kafka-producer.js's publishTaskEvent comment is the canonical
// statement): a bill has already been marked paid in Postgres by the time
// this runs, so a Kafka publish failure shouldn't fail the webhook
// response back to Stripe. Errors are logged, never propagated — this
// includes the producer simply not being connected yet (a webhook
// arriving in the first few seconds after a cold start, before
// spawn_connect's background task has finished).
pub async fn publish_bill_paid(producer: &Producer, bill: &Bill) {
    let Some(partition_client) = producer.get() else {
        tracing::warn!(task_id = %bill.task_id, "kafka producer not connected yet, dropping bill.paid event");
        return;
    };

    let value = match serde_json::to_vec(&serde_json::json!({
        "event": "bill.paid",
        "task_id": bill.task_id,
        "bill_id": bill.id,
        "amount_cents": bill.amount_cents,
        "currency": bill.currency,
        "paid_at": bill.paid_at,
    })) {
        Ok(v) => v,
        Err(err) => {
            tracing::error!(?err, task_id = %bill.task_id, "failed to serialize bill.paid event");
            return;
        }
    };

    let record = Record {
        key: Some(bill.task_id.to_string().into_bytes()),
        value: Some(value),
        headers: BTreeMap::new(),
        timestamp: Utc::now(),
    };

    if let Err(err) = partition_client.produce(vec![record], Compression::default()).await {
        tracing::error!(?err, task_id = %bill.task_id, "failed to publish bill.paid");
    }
}
