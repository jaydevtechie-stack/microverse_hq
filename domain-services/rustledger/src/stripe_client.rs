use std::sync::OnceLock;
use stripe::{
    CheckoutSession, CheckoutSessionMode, Client, CreateCheckoutSession,
    CreateCheckoutSessionLineItems, CreateCheckoutSessionLineItemsPriceData,
    CreateCheckoutSessionLineItemsPriceDataProductData, Currency, Event, EventObject, EventType,
    Webhook,
};

use crate::models::Bill;

static CLIENT: OnceLock<Client> = OnceLock::new();

// Built once and reused — Client wraps its own connection pool, so
// constructing a fresh one on every "View invoice" click would pay a new
// TCP+TLS handshake to Stripe on every checkout attempt instead of
// reusing a keep-alive connection.
fn client() -> &'static Client {
    CLIENT.get_or_init(|| {
        let secret_key = std::env::var("STRIPE_SECRET_KEY").unwrap_or_default();
        Client::new(secret_key)
    })
}

fn app_base_url() -> String {
    std::env::var("APP_BASE_URL").unwrap_or_else(|_| "http://localhost".to_string())
}

// Creates a Stripe-hosted Checkout Session for one bill and returns the
// URL to redirect the browser to. client_reference_id carries the task_id
// through to the webhook (parse_checkout_completed below), since that's
// the one durable identifier both sides agree on.
pub async fn create_checkout_session(bill: &Bill) -> Result<String, String> {
    let currency: Currency = bill
        .currency
        .to_lowercase()
        .parse()
        .map_err(|_| format!("unsupported currency: {}", bill.currency))?;

    let task_id = bill.task_id.to_string();
    let success_url = format!("{}/task/{}", app_base_url(), task_id);
    let cancel_url = success_url.clone();
    let product_name = format!("Microverse task {task_id}");

    let mut product_data = CreateCheckoutSessionLineItemsPriceDataProductData::default();
    product_data.name = product_name;

    let mut price_data = CreateCheckoutSessionLineItemsPriceData::default();
    price_data.currency = currency;
    price_data.unit_amount = Some(bill.amount_cents);
    price_data.product_data = Some(product_data);

    let mut line_item = CreateCheckoutSessionLineItems::default();
    line_item.price_data = Some(price_data);
    line_item.quantity = Some(1);

    let mut params = CreateCheckoutSession::new();
    params.mode = Some(CheckoutSessionMode::Payment);
    params.client_reference_id = Some(&task_id);
    params.line_items = Some(vec![line_item]);
    params.success_url = Some(&success_url);
    params.cancel_url = Some(&cancel_url);

    let session = CheckoutSession::create(client(), params)
        .await
        .map_err(|e| e.to_string())?;

    session.url.ok_or_else(|| "Stripe returned no checkout URL".to_string())
}

pub struct CheckoutCompleted {
    pub task_id: String,
    pub checkout_session_id: String,
    pub payment_intent_id: String,
}

// Verifies the webhook signature (payload must be the exact raw request
// body — see api.rs's Bytes extractor on this route) and, if it's a
// checkout.session.completed event, extracts what mark_bill_paid needs.
// Any other event type returns Ok(None) — not every webhook Stripe sends
// is one we act on.
pub fn parse_checkout_completed(
    payload: &str,
    signature: &str,
    webhook_secret: &str,
) -> Result<Option<CheckoutCompleted>, String> {
    let event: Event = Webhook::construct_event(payload, signature, webhook_secret)
        .map_err(|e| e.to_string())?;

    if event.type_ != EventType::CheckoutSessionCompleted {
        return Ok(None);
    }

    let EventObject::CheckoutSession(session) = event.data.object else {
        return Ok(None);
    };

    let Some(task_id) = session.client_reference_id else {
        return Ok(None);
    };

    let payment_intent_id = session
        .payment_intent
        .map(|pi| pi.id().to_string())
        .unwrap_or_default();

    Ok(Some(CheckoutCompleted {
        task_id,
        checkout_session_id: session.id.to_string(),
        payment_intent_id,
    }))
}
