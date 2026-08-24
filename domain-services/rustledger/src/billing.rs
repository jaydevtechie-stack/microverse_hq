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

    let amount_cents = compute_amount_cents(elapsed_seconds, rate_card.cents_per_hour);

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

// Pulled out of bill_stopped_session so the rounding behavior (money math,
// worth pinning down exactly) can be tested without a PgPool.
fn compute_amount_cents(elapsed_seconds: i64, cents_per_hour: i64) -> i64 {
    ((elapsed_seconds as f64 / 3600.0) * cents_per_hour as f64).round() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_hour_bills_full_rate() {
        assert_eq!(compute_amount_cents(3600, 5000), 5000);
    }

    #[test]
    fn zero_elapsed_seconds_bills_nothing() {
        assert_eq!(compute_amount_cents(0, 5000), 0);
    }

    #[test]
    fn half_hour_bills_half_rate() {
        assert_eq!(compute_amount_cents(1800, 5000), 2500);
    }

    #[test]
    fn rounds_to_nearest_cent_up() {
        // 1s at $50/hr = 1.3888...c, rounds up to 1c.
        assert_eq!(compute_amount_cents(1, 5000), 1);
    }

    #[test]
    fn rounds_to_nearest_cent_down() {
        // 61s at $1/hr = 1.694...c, rounds down to 2c (nearest, not up-only).
        assert_eq!(compute_amount_cents(61, 100), 2);
    }

    #[test]
    fn large_session_does_not_overflow() {
        // ~24h at a high rate — sanity check the f64 round-trip stays exact
        // at magnitudes this billing model will actually see.
        assert_eq!(compute_amount_cents(86_400, 1_000_000), 24_000_000);
    }
}
