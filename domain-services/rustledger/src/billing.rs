use sqlx::PgPool;
use uuid::Uuid;

use crate::models::SessionEvent;

/// Flat rate for every analyst — real per-analyst/contract rates (and
/// upfront-vs-later billing terms) are a follow-up, not this first cut.
pub struct RateCard {
    pub cents_per_hour: i64,
    pub currency: String,
}

impl RateCard {
    pub fn from_env() -> Self {
        let cents_per_hour = std::env::var("DEFAULT_HOURLY_RATE_CENTS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5000);
        let currency = std::env::var("DEFAULT_CURRENCY").unwrap_or_else(|_| "USD".to_string());
        Self { cents_per_hour, currency }
    }
}

/// Turns a "session.stopped" event into a billed line item. Idempotent —
/// relies on the unique index on session_id to no-op on redelivery.
pub async fn bill_stopped_session(
    pool: &PgPool,
    rate_card: &RateCard,
    event: &SessionEvent,
) -> Result<(), sqlx::Error> {
    let elapsed_seconds = match event.elapsed_seconds {
        Some(s) => s,
        None => {
            tracing::warn!(
                session_id = %event.session_id,
                "session.stopped event had no elapsed_seconds, skipping"
            );
            return Ok(());
        }
    };

    let amount_cents =
        ((elapsed_seconds as f64 / 3600.0) * rate_card.cents_per_hour as f64).round() as i64;

    let result = sqlx::query(
        r#"
        INSERT INTO rustledger.line_items
            (id, session_id, analyst_id, quest_id, elapsed_seconds, rate_cents_per_hour, amount_cents, currency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_id) DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&event.session_id)
    .bind(&event.analyst_id)
    .bind(&event.quest_id)
    .bind(elapsed_seconds)
    .bind(rate_card.cents_per_hour)
    .bind(amount_cents)
    .bind(&rate_card.currency)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        tracing::info!(session_id = %event.session_id, "line item already billed, skipping");
    } else {
        tracing::info!(
            session_id = %event.session_id,
            analyst_id = %event.analyst_id,
            amount_cents,
            "billed session"
        );
    }

    Ok(())
}
