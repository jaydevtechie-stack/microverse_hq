use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Bill;

pub struct NewBill {
    pub task_id: Uuid,
    pub customer_id: Uuid,
    pub amount_cents: i64,
    pub currency: String,
}

/// One bill per task — ON CONFLICT surfaces as an error to the caller
/// (unlike line_items' silent no-op) since a duplicate create-bill call
/// is a client mistake worth reporting, not a Kafka-redelivery no-op.
pub async fn create_bill(pool: &PgPool, new_bill: NewBill) -> Result<Bill, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        r#"
        INSERT INTO rustledger.bills
            (id, task_id, customer_id, amount_cents, currency)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, task_id, customer_id, amount_cents, currency, status,
                  stripe_checkout_session_id, stripe_payment_intent_id,
                  created_at, paid_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(new_bill.task_id)
    .bind(new_bill.customer_id)
    .bind(new_bill.amount_cents)
    .bind(new_bill.currency)
    .fetch_one(pool)
    .await
}

pub async fn get_bill_by_task(pool: &PgPool, task_id: Uuid) -> Result<Option<Bill>, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        "SELECT id, task_id, customer_id, amount_cents, currency, status, \
         stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at \
         FROM rustledger.bills WHERE task_id = $1",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
}

pub struct PaidDetails {
    pub stripe_checkout_session_id: String,
    pub stripe_payment_intent_id: String,
}

/// Idempotent — WHERE status = 'unpaid' guards against a redelivered or
/// duplicate webhook re-marking an already-paid bill. Returns None on a
/// no-op (already paid, or no bill for that task) rather than erroring —
/// callers treat "nothing to do" the same as "did it."
pub async fn mark_bill_paid(
    pool: &PgPool,
    task_id: Uuid,
    details: PaidDetails,
) -> Result<Option<Bill>, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        r#"
        UPDATE rustledger.bills
        SET status = 'paid',
            stripe_checkout_session_id = $2,
            stripe_payment_intent_id = $3,
            paid_at = $4
        WHERE task_id = $1 AND status = 'unpaid'
        RETURNING id, task_id, customer_id, amount_cents, currency, status,
                  stripe_checkout_session_id, stripe_payment_intent_id,
                  created_at, paid_at
        "#,
    )
    .bind(task_id)
    .bind(details.stripe_checkout_session_id)
    .bind(details.stripe_payment_intent_id)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await
}
