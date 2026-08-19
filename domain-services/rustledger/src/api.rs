use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{claims_from_headers, Claims};
use crate::billing::RateCard;
use crate::bills::{self, NewBill, PaidDetails};
use crate::kafka_producer;
use crate::models::{AnalystTotal, Bill, LineItem};
use crate::stripe_client;
use crate::task_client;

// Full ledger visibility (any analyst's line items/totals) is billing
// data with no access-control design yet — Branch 9 in ROADMAP.md
// leaves "who can see whose billing" an open question. platform:admin
// is a conservative interim gate to close the OWASP A01 finding
// (docs/security.md: rustledger had zero auth, unlike every other
// service) without guessing at that unbuilt design; revisit once
// Branch 9's payout-visibility model actually exists.
fn require_admin(headers: &HeaderMap) -> Result<Claims, (StatusCode, String)> {
    require_any_role(headers, &["platform:admin"])
}

// Generalized for the bill endpoints below, which need PM/customer/admin
// combinations rather than admin-only — same claim-extraction, just a
// list of acceptable roles instead of one. Returns the parsed Claims so
// callers can read email/sub off it without extracting twice.
fn require_any_role(headers: &HeaderMap, roles: &[&str]) -> Result<Claims, (StatusCode, String)> {
    let claims = claims_from_headers(headers)
        .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed token".into()))?;
    if !roles.iter().any(|role| claims.has_role(role)) {
        return Err((
            StatusCode::FORBIDDEN,
            format!("requires one of: {}", roles.join(", ")),
        ));
    }
    Ok(claims)
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub kafka_producer: kafka_producer::Producer,
}

pub fn router(pool: PgPool, kafka_producer: kafka_producer::Producer) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/line-items", get(list_line_items))
        .route("/api/analysts/{analyst_id}/total", get(analyst_total))
        .route("/api/billing/bills", post(create_bill))
        .route("/api/billing/bills/by-task/{task_id}", get(get_bill_by_task))
        .route(
            "/api/billing/bills/by-task/{task_id}/checkout-session",
            post(create_checkout_session),
        )
        .route("/api/billing/webhooks/stripe", post(stripe_webhook))
        .with_state(AppState { pool, kafka_producer })
}

async fn health() -> impl IntoResponse {
    StatusCode::OK
}

#[derive(Deserialize)]
struct LineItemsQuery {
    analyst_id: Option<String>,
}

async fn list_line_items(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<LineItemsQuery>,
) -> Result<Json<Vec<LineItem>>, (StatusCode, String)> {
    require_admin(&headers)?;

    let rows = match query.analyst_id {
        Some(analyst_id) => sqlx::query_as::<_, LineItem>(
            "SELECT id, session_id, analyst_id, quest_id, elapsed_seconds, \
             rate_cents_per_hour, amount_cents, currency, created_at \
             FROM rustledger.line_items WHERE analyst_id = $1 ORDER BY created_at DESC",
        )
        .bind(analyst_id)
        .fetch_all(&state.pool)
        .await,
        None => sqlx::query_as::<_, LineItem>(
            "SELECT id, session_id, analyst_id, quest_id, elapsed_seconds, \
             rate_cents_per_hour, amount_cents, currency, created_at \
             FROM rustledger.line_items ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await,
    };

    rows.map(Json)
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

async fn analyst_total(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(analyst_id): Path<String>,
) -> Result<Json<AnalystTotal>, (StatusCode, String)> {
    require_admin(&headers)?;

    let rate_card = RateCard::from_env();

    // Postgres SUM(bigint) returns numeric, not bigint — cast explicitly so
    // sqlx can decode it as i64 (amount_cents will never approach overflow)
    let total_cents: Option<i64> = sqlx::query_scalar(
        "SELECT SUM(amount_cents)::BIGINT FROM rustledger.line_items WHERE analyst_id = $1",
    )
    .bind(&analyst_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    Ok(Json(AnalystTotal {
        analyst_id,
        total_cents: total_cents.unwrap_or(0),
        currency: rate_card.currency,
    }))
}

#[derive(Deserialize)]
struct CreateBillBody {
    task_id: Uuid,
    amount_cents: i64,
    currency: String,
}

// PM creates the bill once a task reaches 'done' (task.approved). Amount
// is entered by the PM, not computed — no price/rate field exists
// anywhere on tasks or projects yet (docs/schema.md). task status/owner
// are re-verified against task-service itself (task_client.rs) rather
// than trusted from the request body — customer_id in particular is
// *derived* from the fetched task, never accepted from the client. This
// used to be billing-service's job (a separate Node service in front of
// rustledger); folded in here now that rustledger owns the whole billing
// flow directly.
async fn create_bill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateBillBody>,
) -> Result<Json<Bill>, (StatusCode, String)> {
    let claims = require_any_role(&headers, &["platform:project-manager", "platform:admin"])?;
    let caller_email = claims
        .email()
        .ok_or((StatusCode::UNAUTHORIZED, "token has no email".into()))?;

    if body.amount_cents <= 0 {
        return Err((StatusCode::BAD_REQUEST, "amount_cents must be positive".into()));
    }

    let task = task_client::fetch_task(&body.task_id.to_string())
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?
        .ok_or((StatusCode::NOT_FOUND, "task not found".into()))?;

    if task.status != "done" {
        return Err((
            StatusCode::CONFLICT,
            format!("task is \"{}\", not done", task.status),
        ));
    }
    if task.owner.as_deref() != Some(caller_email) {
        return Err((StatusCode::FORBIDDEN, "not this task's owner".into()));
    }
    let customer_id = task
        .customer_id
        .ok_or((StatusCode::CONFLICT, "task has no customer to bill".into()))?;

    bills::create_bill(
        &state.pool,
        NewBill {
            task_id: body.task_id,
            customer_id,
            amount_cents: body.amount_cents,
            currency: body.currency.to_uppercase(),
        },
    )
    .await
    .map(Json)
    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

// A customer may only ever touch their own bill — PM/admin can see any
// bill.
fn forbidden_for_customer(claims: &Claims, bill: &Bill) -> bool {
    let customer_only = claims.has_role("platform:customer")
        && !claims.has_role("platform:project-manager")
        && !claims.has_role("platform:admin");
    customer_only && claims.sub() != Some(bill.customer_id.to_string().as_str())
}

async fn get_bill_by_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Bill>, (StatusCode, String)> {
    let claims = require_any_role(
        &headers,
        &["platform:project-manager", "platform:customer", "platform:admin"],
    )?;

    let bill = bills::get_bill_by_task(&state.pool, task_id)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "no bill for that task".into()))?;

    if forbidden_for_customer(&claims, &bill) {
        return Err((StatusCode::FORBIDDEN, "not this customer's bill".into()));
    }

    Ok(Json(bill))
}

#[derive(Serialize)]
struct CheckoutSessionResponse {
    url: String,
}

// Customer clicks "View invoice" (CustomerProgressPanel.js) — creates a
// Stripe-hosted Checkout Session for the bill's amount and redirects the
// browser there.
async fn create_checkout_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(task_id): Path<Uuid>,
) -> Result<Json<CheckoutSessionResponse>, (StatusCode, String)> {
    let claims = require_any_role(&headers, &["platform:customer"])?;

    let bill = bills::get_bill_by_task(&state.pool, task_id)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "no bill for that task".into()))?;

    if forbidden_for_customer(&claims, &bill) {
        return Err((StatusCode::FORBIDDEN, "not this customer's bill".into()));
    }
    if bill.status == "paid" {
        return Err((StatusCode::CONFLICT, "bill already paid".into()));
    }

    let url = stripe_client::create_checkout_session(&bill)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(CheckoutSessionResponse { url }))
}

// Stripe itself is the caller — no role gate, signature verification
// (stripe_client::parse_checkout_completed) is this route's auth. The
// body must be the exact raw bytes Stripe sent (Bytes extractor, not
// Json<T>) since signature verification hashes the raw payload — unlike
// Express, Axum extracts per-handler so this doesn't need any global
// middleware-ordering trick to get an unparsed body.
async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, (StatusCode, String)> {
    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::BAD_REQUEST, "missing stripe-signature header".into()))?;
    let payload =
        std::str::from_utf8(&body).map_err(|_| (StatusCode::BAD_REQUEST, "invalid payload encoding".into()))?;
    let webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();

    let completed = stripe_client::parse_checkout_completed(payload, signature, &webhook_secret)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Webhook Error: {e}")))?;

    let Some(completed) = completed else {
        return Ok(StatusCode::OK);
    };

    let task_id: Uuid = completed
        .task_id
        .parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "checkout session had no valid task_id".into()))?;

    let bill = bills::mark_bill_paid(
        &state.pool,
        task_id,
        PaidDetails {
            stripe_checkout_session_id: completed.checkout_session_id,
            stripe_payment_intent_id: completed.payment_intent_id,
        },
    )
    .await
    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    // None on a redelivered webhook for an already-paid bill (rustledger's
    // WHERE status = 'unpaid' guard in mark_bill_paid) — nothing new to
    // publish in that case, same idempotency posture as every Kafka
    // consumer in this stack.
    if let Some(bill) = bill {
        kafka_producer::publish_bill_paid(&state.kafka_producer, &bill).await;
    }

    Ok(StatusCode::OK)
}
