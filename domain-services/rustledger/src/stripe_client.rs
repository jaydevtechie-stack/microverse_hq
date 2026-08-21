use std::sync::OnceLock;
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;
use stripe::{
    CheckoutSession, CheckoutSessionMode, Client, CreateCheckoutSession,
    CreateCheckoutSessionLineItems, CreateCheckoutSessionLineItemsPriceData,
    CreateCheckoutSessionLineItemsPriceDataProductData, Currency,
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

#[derive(Debug)]
pub struct CheckoutCompleted {
    pub task_id: String,
    pub checkout_session_id: String,
    pub payment_intent_id: String,
}

// Verifies a Stripe-Signature header against the raw payload — same HMAC
// scheme as async-stripe's own Webhook::construct_event, reimplemented
// here so verification doesn't depend on the payload also deserializing
// into the crate's typed Event/CheckoutSession structs (see
// parse_checkout_completed's comment for why that matters).
fn verify_signature(payload: &str, sig_header: &str, secret: &str) -> Result<(), String> {
    let mut timestamp: Option<i64> = None;
    let mut v1: Option<&str> = None;
    for part in sig_header.split(',') {
        let mut kv = part.splitn(2, '=');
        match (kv.next(), kv.next()) {
            (Some("t"), Some(v)) => timestamp = v.parse().ok(),
            (Some("v1"), Some(v)) => v1 = Some(v),
            _ => {}
        }
    }
    let timestamp = timestamp.ok_or("missing timestamp in stripe-signature header")?;
    let v1 = v1.ok_or("missing v1 signature in stripe-signature header")?;

    let signed_payload = format!("{timestamp}.{payload}");
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|_| "invalid webhook secret".to_string())?;
    mac.update(signed_payload.as_bytes());
    let expected = hex::decode(v1).map_err(|_| "malformed v1 signature".to_string())?;
    mac.verify_slice(&expected).map_err(|_| "signature mismatch".to_string())?;

    if (chrono::Utc::now().timestamp() - timestamp).abs() > 300 {
        return Err("signature timestamp too old".to_string());
    }
    Ok(())
}

// Verifies the webhook signature (payload must be the exact raw request
// body — see api.rs's Bytes extractor on this route) and, if it's a
// checkout.session.completed event, extracts what mark_bill_paid needs.
// Any other event type returns Ok(None) — not every webhook Stripe sends
// is one we act on.
//
// Deliberately parses the payload as untyped JSON instead of async-stripe's
// typed Event/CheckoutSession (as this used to) — that struct is generated
// against a fixed API version (2023-10-16 as of async-stripe 0.41.0, see
// resources/generated/version.rs), and a live Stripe account defaults to
// whatever its current API version is (2026-07-29.dahlia when this was
// hit). stripe listen forwards events shaped in the account's version with
// no way to pin it older, so a multi-year schema drift on fields we don't
// even use broke deserialization of the whole event. The 3 fields below
// are stable, well-documented parts of the Checkout Session object and
// don't need the typed model.
pub fn parse_checkout_completed(
    payload: &str,
    signature: &str,
    webhook_secret: &str,
) -> Result<Option<CheckoutCompleted>, String> {
    verify_signature(payload, signature, webhook_secret)?;

    let event: Value = serde_json::from_str(payload).map_err(|e| e.to_string())?;

    if event.get("type").and_then(Value::as_str) != Some("checkout.session.completed") {
        return Ok(None);
    }

    let session = event
        .get("data")
        .and_then(|d| d.get("object"))
        .ok_or("webhook event had no data.object")?;

    let Some(task_id) = session.get("client_reference_id").and_then(Value::as_str) else {
        return Ok(None);
    };

    let checkout_session_id = session
        .get("id")
        .and_then(Value::as_str)
        .ok_or("checkout session had no id")?
        .to_string();

    // payment_intent is either a bare ID string or an expanded object,
    // depending on whether the event was created with expand requested.
    let payment_intent_id = session
        .get("payment_intent")
        .and_then(|pi| {
            pi.as_str()
                .map(str::to_string)
                .or_else(|| pi.get("id").and_then(Value::as_str).map(str::to_string))
        })
        .unwrap_or_default();

    Ok(Some(CheckoutCompleted {
        task_id: task_id.to_string(),
        checkout_session_id,
        payment_intent_id,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "whsec_test_secret";

    // Builds a real `t=...,v1=...` header the same way Stripe does, so
    // tests exercise verify_signature's actual HMAC check rather than
    // bypassing it.
    fn sign(payload: &str, secret: &str, timestamp: i64) -> String {
        let signed_payload = format!("{timestamp}.{payload}");
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());
        format!("t={timestamp},v1={sig}")
    }

    fn checkout_completed_payload(session_object: &str) -> String {
        format!(
            r#"{{"type":"checkout.session.completed","data":{{"object":{session_object}}}}}"#
        )
    }

    #[test]
    fn valid_signature_and_checkout_completed_extracts_fields() {
        let session = r#"{"id":"cs_123","client_reference_id":"task-1","payment_intent":"pi_123"}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, SECRET, now);

        let result = parse_checkout_completed(&payload, &sig, SECRET).unwrap();
        let completed = result.expect("expected Some(CheckoutCompleted)");
        assert_eq!(completed.task_id, "task-1");
        assert_eq!(completed.checkout_session_id, "cs_123");
        assert_eq!(completed.payment_intent_id, "pi_123");
    }

    #[test]
    fn payment_intent_as_expanded_object_extracts_its_id() {
        let session = r#"{"id":"cs_123","client_reference_id":"task-1","payment_intent":{"id":"pi_expanded","status":"succeeded"}}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, SECRET, now);

        let completed = parse_checkout_completed(&payload, &sig, SECRET)
            .unwrap()
            .expect("expected Some(CheckoutCompleted)");
        assert_eq!(completed.payment_intent_id, "pi_expanded");
    }

    #[test]
    fn missing_payment_intent_defaults_to_empty_string() {
        let session = r#"{"id":"cs_123","client_reference_id":"task-1"}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, SECRET, now);

        let completed = parse_checkout_completed(&payload, &sig, SECRET)
            .unwrap()
            .expect("expected Some(CheckoutCompleted)");
        assert_eq!(completed.payment_intent_id, "");
    }

    #[test]
    fn wrong_signature_is_rejected() {
        let session = r#"{"id":"cs_123","client_reference_id":"task-1"}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, "a-different-secret", now);

        let err = parse_checkout_completed(&payload, &sig, SECRET).unwrap_err();
        assert_eq!(err, "signature mismatch");
    }

    #[test]
    fn tampered_payload_is_rejected() {
        let session = r#"{"id":"cs_123","client_reference_id":"task-1"}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, SECRET, now);

        let tampered = payload.replace("task-1", "task-attacker-controlled");
        let err = parse_checkout_completed(&tampered, &sig, SECRET).unwrap_err();
        assert_eq!(err, "signature mismatch");
    }

    #[test]
    fn stale_timestamp_is_rejected_even_with_valid_signature() {
        let session = r#"{"id":"cs_123","client_reference_id":"task-1"}"#;
        let payload = checkout_completed_payload(session);
        let old_timestamp = chrono::Utc::now().timestamp() - 301; // just over the 300s window
        let sig = sign(&payload, SECRET, old_timestamp);

        let err = parse_checkout_completed(&payload, &sig, SECRET).unwrap_err();
        assert_eq!(err, "signature timestamp too old");
    }

    #[test]
    fn malformed_signature_header_is_rejected() {
        let payload = checkout_completed_payload(r#"{"id":"cs_123"}"#);

        let err = parse_checkout_completed(&payload, "not-a-valid-header", SECRET).unwrap_err();
        assert_eq!(err, "missing timestamp in stripe-signature header");
    }

    #[test]
    fn non_checkout_event_type_returns_none_not_error() {
        let payload = r#"{"type":"payment_intent.created","data":{"object":{}}}"#;
        let now = chrono::Utc::now().timestamp();
        let sig = sign(payload, SECRET, now);

        let result = parse_checkout_completed(payload, &sig, SECRET).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn missing_client_reference_id_returns_none_not_error() {
        // Not every Checkout Session was created by rustledger (or is one
        // rustledger cares about) — no client_reference_id means there's
        // nothing to bill against, so this is a deliberate no-op, not a
        // parse failure.
        let session = r#"{"id":"cs_123"}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, SECRET, now);

        let result = parse_checkout_completed(&payload, &sig, SECRET).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn missing_session_id_is_a_hard_error() {
        let session = r#"{"client_reference_id":"task-1"}"#;
        let payload = checkout_completed_payload(session);
        let now = chrono::Utc::now().timestamp();
        let sig = sign(&payload, SECRET, now);

        let err = parse_checkout_completed(&payload, &sig, SECRET).unwrap_err();
        assert_eq!(err, "checkout session had no id");
    }
}
