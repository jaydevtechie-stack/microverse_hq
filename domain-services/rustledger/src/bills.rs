use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Bill;

// sqlx 0.9's query_as requires a &'static str (SqlSafeStr) — no
// runtime-built query strings, even to interpolate a shared column list
// constant via format!(). Column lists are duplicated as literals below
// instead, same as before this file first tried to share them.

pub struct NewBill {
    pub task_id: Uuid,
    pub customer_id: Uuid,
    pub amount_cents: i64,
    pub currency: String,
    pub created_by_id: Option<Uuid>,
}

/// One bill per task — ON CONFLICT surfaces as an error to the caller
/// (unlike line_items' silent no-op) since a duplicate create-bill call
/// is a client mistake worth reporting, not a Kafka-redelivery no-op.
pub async fn create_bill(pool: &PgPool, new_bill: NewBill) -> Result<Bill, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        r#"
        INSERT INTO rustledger.bills
            (id, task_id, customer_id, amount_cents, currency, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, task_id, customer_id, amount_cents, currency, status,
                  stripe_checkout_session_id, stripe_payment_intent_id,
                  created_at, created_by_id, published_at, paid_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(new_bill.task_id)
    .bind(new_bill.customer_id)
    .bind(new_bill.amount_cents)
    .bind(new_bill.currency)
    .bind(new_bill.created_by_id)
    .fetch_one(pool)
    .await
}

pub async fn get_bill_by_task(pool: &PgPool, task_id: Uuid) -> Result<Option<Bill>, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        "SELECT id, task_id, customer_id, amount_cents, currency, status, \
         stripe_checkout_session_id, stripe_payment_intent_id, created_at, \
         created_by_id, published_at, paid_at \
         FROM rustledger.bills WHERE task_id = $1",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
}

/// GET /api/billing/bills for a PM-only caller — their own bills, not
/// every bill (api.rs's list_bills: AM/admin get list_all_bills instead,
/// unscoped by design like every other AM view in this stack).
pub async fn list_bills_for_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Bill>, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        "SELECT id, task_id, customer_id, amount_cents, currency, status, \
         stripe_checkout_session_id, stripe_payment_intent_id, created_at, \
         created_by_id, published_at, paid_at \
         FROM rustledger.bills WHERE created_by_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// GET /api/billing/bills for an AM/admin caller — every bill, across
/// every service/PM. No pagination yet, same posture as list_line_items.
pub async fn list_all_bills(pool: &PgPool) -> Result<Vec<Bill>, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        "SELECT id, task_id, customer_id, amount_cents, currency, status, \
         stripe_checkout_session_id, stripe_payment_intent_id, created_at, \
         created_by_id, published_at, paid_at \
         FROM rustledger.bills ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

/// The account manager's explicit "release to customer" action
/// (create_bill leaves a bill as a draft, published_at NULL) — idempotent
/// the same way mark_bill_paid is: WHERE published_at IS NULL guards
/// against a double-click re-publishing (and re-notifying) an already-
/// published bill. None means either no bill exists for that task or
/// it's already published — api.rs's publish_bill distinguishes those
/// for the error message with its own pre-check, since both look the
/// same from here.
pub async fn publish_bill(pool: &PgPool, task_id: Uuid) -> Result<Option<Bill>, sqlx::Error> {
    sqlx::query_as::<_, Bill>(
        r#"
        UPDATE rustledger.bills
        SET published_at = now()
        WHERE task_id = $1 AND published_at IS NULL
        RETURNING id, task_id, customer_id, amount_cents, currency, status,
                  stripe_checkout_session_id, stripe_payment_intent_id,
                  created_at, created_by_id, published_at, paid_at
        "#,
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
                  created_at, created_by_id, published_at, paid_at
        "#,
    )
    .bind(task_id)
    .bind(details.stripe_checkout_session_id)
    .bind(details.stripe_payment_intent_id)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await
}
