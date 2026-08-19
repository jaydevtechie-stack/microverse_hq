use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Envelope for every event on the elixtempo.sessions topic. RustLedger
/// only acts on "session.stopped" — that's the only event with a final
/// elapsed_seconds to bill.
#[derive(Debug, Deserialize)]
pub struct SessionEvent {
    pub event: String,
    pub session_id: String,
    pub analyst_id: String,
    pub quest_id: String,
    #[allow(dead_code)]
    pub occurred_at: DateTime<Utc>,
    #[serde(default)]
    pub elapsed_seconds: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LineItem {
    pub id: Uuid,
    pub session_id: String,
    pub analyst_id: String,
    pub quest_id: String,
    pub elapsed_seconds: i64,
    pub rate_cents_per_hour: i64,
    pub amount_cents: i64,
    pub currency: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AnalystTotal {
    pub analyst_id: String,
    pub total_cents: i64,
    pub currency: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Bill {
    pub id: Uuid,
    pub task_id: Uuid,
    pub customer_id: Uuid,
    pub amount_cents: i64,
    pub currency: String,
    pub status: String,
    pub stripe_checkout_session_id: Option<String>,
    pub stripe_payment_intent_id: Option<String>,
    pub created_at: DateTime<Utc>,
    // NULL = still a PM-only draft, invisible/unpayable to the customer
    // (api.rs's fetch_authorized_bill gates on this). Set by publish_bill
    // — the PM's explicit "release this to the customer" action, distinct
    // from create_bill.
    pub published_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
}
