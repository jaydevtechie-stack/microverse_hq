use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Json, Response};
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

// Every other service in this stack (task-routes.js, audit-routes.js,
// asset-service's api.rs) returns `{ "message": "..." }` on error — a
// bare (StatusCode, String) renders as text/plain via axum's built-in
// IntoResponse, which broke every frontend call site here (CreateBillPanel.js/
// CustomerProgressPanel.js both do `const body = await res.json()`
// unconditionally, which throws parsing a text/plain error body before
// the intended message or status-specific handling is ever reached).
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(serde_json::json!({ "message": self.message }))).into_response()
    }
}

// Full ledger visibility (any analyst's line items/totals) is billing
// data with no access-control design yet — Branch 9 in ROADMAP.md
// leaves "who can see whose billing" an open question. platform:admin
// is a conservative interim gate to close the OWASP A01 finding
// (docs/security.md: rustledger had zero auth, unlike every other
// service) without guessing at that unbuilt design; revisit once
// Branch 9's payout-visibility model actually exists.
fn require_admin(headers: &HeaderMap) -> Result<Claims, ApiError> {
    require_any_role(headers, &["platform:admin"])
}

// Generalized for the bill endpoints below, which need PM/customer/admin
// combinations rather than admin-only — same claim-extraction, just a
// list of acceptable roles instead of one. Returns the parsed Claims so
// callers can read email/sub off it without extracting twice.
fn require_any_role(headers: &HeaderMap, roles: &[&str]) -> Result<Claims, ApiError> {
    let claims = claims_from_headers(headers)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "missing or malformed token"))?;
    if !roles.iter().any(|role| claims.has_role(role)) {
        return Err(ApiError::new(
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
        .route("/api/billing/bills", post(create_bill).get(list_bills))
        .route("/api/billing/bills/by-task/{task_id}", get(get_bill_by_task))
        .route("/api/billing/bills/by-task/{task_id}/publish", post(publish_bill))
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
) -> Result<Json<Vec<LineItem>>, ApiError> {
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
        .map_err(|err| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

async fn analyst_total(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(analyst_id): Path<String>,
) -> Result<Json<AnalystTotal>, ApiError> {
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
    .map_err(|err| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    Ok(Json(AnalystTotal {
        analyst_id,
        total_cents: total_cents.unwrap_or(0),
        currency: rate_card.currency,
    }))
}

// camelCase — matches PmBillPanel.js's JSON.stringify({ taskId, amountCents,
// currency }) body. The deleted billing-service Node layer used to
// translate this into snake_case before calling rustledger
// (services/rustledger-client.js's createBill); that translation has to
// happen here now that the frontend calls rustledger directly.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateBillBody {
    task_id: Uuid,
    amount_cents: i64,
    currency: String,
}

// create_bill's authorization — the task must be 'done', and the caller
// must be its owner (or platform:admin, which bypasses the ownership
// match entirely — an admin isn't the task's owner and shouldn't need to
// be, same as every other admin escape hatch in this file). publish_bill
// used to share this (an earlier pass had the PM both create and
// publish), but publishing moved to the account manager — an AM's reach
// is unscoped by design (matching platform:account-manager everywhere
// else in this stack), so there's no per-task ownership to check there
// anymore, and no task-service round trip needed for that route either.
async fn authorize_pm_for_task(claims: &Claims, task_id: Uuid) -> Result<task_client::Task, ApiError> {
    let task = task_client::fetch_task(&task_id.to_string())
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, e))?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "task not found"))?;

    if task.status != "done" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            format!("task is \"{}\", not done", task.status),
        ));
    }

    if !claims.has_role("platform:admin") {
        let caller_email = claims
            .email()
            .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "token has no email"))?;
        if task.owner.as_deref() != Some(caller_email) {
            return Err(ApiError::new(StatusCode::FORBIDDEN, "not this task's owner"));
        }
    }

    Ok(task)
}

// PM creates the bill once a task reaches 'done' (task.approved). Amount
// is entered by the PM, not computed — no price/rate field exists
// anywhere on tasks or projects yet (docs/schema.md). Creates as a draft
// — invisible to the customer and silent (no notification) until the PM
// explicitly publishes it (publish_bill below), so a PM can create a
// bill, double check the amount, and only then release it. task status/
// owner are re-verified against task-service itself rather than trusted
// from the request body — customer_id in particular is *derived* from
// the fetched task, never accepted from the client.
async fn create_bill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateBillBody>,
) -> Result<Json<Bill>, ApiError> {
    let claims = require_any_role(&headers, &["platform:project-manager", "platform:admin"])?;

    if body.amount_cents <= 0 {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "amount_cents must be positive"));
    }

    let task = authorize_pm_for_task(&claims, body.task_id).await?;
    let customer_id = task
        .customer_id
        .ok_or_else(|| ApiError::new(StatusCode::CONFLICT, "task has no customer to bill"))?;

    bills::create_bill(
        &state.pool,
        NewBill {
            task_id: body.task_id,
            customer_id,
            amount_cents: body.amount_cents,
            currency: body.currency.to_uppercase(),
            created_by_id: claims.sub().and_then(|sub| sub.parse::<Uuid>().ok()),
        },
    )
    .await
    .map(Json)
    .map_err(|err| {
        // bills_task_id_key's unique violation on a genuine double-submit
        // (double-click, two PM tabs racing) is a client-recoverable
        // conflict, not a server fault — map it to a clean 409 instead of
        // falling through to the generic 500 branch below, which would
        // otherwise surface the raw Postgres constraint-violation message
        // to the client.
        if err
            .as_database_error()
            .is_some_and(|db_err| db_err.is_unique_violation())
        {
            ApiError::new(StatusCode::CONFLICT, "a bill already exists for this task")
        } else {
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
        }
    })
}

// Creating a bill and releasing it to the customer are two separate
// actions by two different roles, not one — the PM creates it
// (create_bill above), the account manager publishes it. This is where
// the customer actually finds out (email + in-app notification, via
// notification-service consuming bill.published off rustledger.bills)
// and where the bill becomes visible/payable to them at all
// (fetch_authorized_bill below gates GET/checkout-session on
// published_at being set, for anyone who isn't staff). No task-ownership
// check here — an AM's reach is unscoped by design, same as every other
// AM-gated endpoint in this stack (e.g. GET /accounts elsewhere).
async fn publish_bill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Bill>, ApiError> {
    require_any_role(&headers, &["platform:account-manager", "platform:admin"])?;

    let bill = bills::publish_bill(&state.pool, task_id)
        .await
        .map_err(|err| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?
        .ok_or_else(|| ApiError::new(StatusCode::CONFLICT, "no draft bill to publish for this task"))?;

    kafka_producer::publish_bill_event("bill.published", &state.kafka_producer, &bill).await;

    Ok(Json(bill))
}

// GET /api/billing/bills — the shared /bills page (BillsPage.js) calls
// this for both roles; the frontend never picks a different path or
// query per role, this handler decides scope from the caller's own
// claims. A PM sees only bills they created (created_by_id — a Keycloak
// sub, not email/username, since either of those can change and would
// silently orphan a PM's own past bills from their view); an AM (or
// admin) sees every bill across every service, matching AM's unscoped
// reach everywhere else in this stack.
async fn list_bills(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Bill>>, ApiError> {
    let claims = require_any_role(
        &headers,
        &["platform:project-manager", "platform:account-manager", "platform:admin"],
    )?;

    let result = if claims.has_role("platform:account-manager") || claims.has_role("platform:admin") {
        bills::list_all_bills(&state.pool).await
    } else {
        let caller_id: Uuid = claims
            .sub()
            .and_then(|sub| sub.parse::<Uuid>().ok())
            .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "token has no valid subject"))?;
        bills::list_bills_for_user(&state.pool, caller_id).await
    };

    result
        .map(Json)
        .map_err(|err| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

fn is_staff(claims: &Claims) -> bool {
    claims.has_role("platform:project-manager")
        || claims.has_role("platform:account-manager")
        || claims.has_role("platform:admin")
}

// A customer may only ever touch their own bill — PM/AM/admin can see
// any bill. Compares parsed UUIDs, not string formatting.
fn forbidden_for_customer(claims: &Claims, bill: &Bill) -> bool {
    if is_staff(claims) {
        return false;
    }
    claims.sub().and_then(|sub| sub.parse::<Uuid>().ok()) != Some(bill.customer_id)
}

// Shared by get_bill_by_task and create_checkout_session — fetch the
// bill for a task and apply the same customer-ownership narrowing both
// routes need, plus the draft/published gate: a bill the PM hasn't
// published yet doesn't exist as far as the customer is concerned (same
// 404 as no bill at all — CustomerProgressPanel.js's existing "not yet
// invoiced" handling already covers this, no frontend change needed).
async fn fetch_authorized_bill(pool: &PgPool, claims: &Claims, task_id: Uuid) -> Result<Bill, ApiError> {
    let bill = bills::get_bill_by_task(pool, task_id)
        .await
        .map_err(|err| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "no bill for that task"))?;

    if forbidden_for_customer(claims, &bill) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "not this customer's bill"));
    }

    if !is_staff(claims) && bill.published_at.is_none() {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "no bill for that task"));
    }

    Ok(bill)
}

async fn get_bill_by_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Bill>, ApiError> {
    let claims = require_any_role(
        &headers,
        &["platform:project-manager", "platform:customer", "platform:admin"],
    )?;

    fetch_authorized_bill(&state.pool, &claims, task_id).await.map(Json)
}

#[derive(Serialize)]
struct CheckoutSessionResponse {
    url: String,
}

// Customer clicks "View invoice" (CustomerProgressPanel.js) — creates a
// Stripe-hosted Checkout Session for the bill's amount and redirects the
// browser there. Always mints a new session (no lookup/reuse of a prior
// open one) — a customer re-clicking after abandoning checkout gets a
// fresh session, which is correct (Stripe sessions expire) even if it
// means a stray unpaid session can accumulate on Stripe's side.
async fn create_checkout_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(task_id): Path<Uuid>,
) -> Result<Json<CheckoutSessionResponse>, ApiError> {
    let claims = require_any_role(&headers, &["platform:customer"])?;

    let bill = fetch_authorized_bill(&state.pool, &claims, task_id).await?;
    if bill.status == "paid" {
        return Err(ApiError::new(StatusCode::CONFLICT, "bill already paid"));
    }

    let url = stripe_client::create_checkout_session(&bill)
        .await
        .map_err(|e| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(CheckoutSessionResponse { url }))
}

// Stripe itself is the caller — no role gate, signature verification
// (stripe_client::parse_checkout_completed) is this route's auth. The
// body must be the exact raw bytes Stripe sent (Bytes extractor, not
// Json<T>) since signature verification hashes the raw payload — unlike
// Express, Axum extracts per-handler so this doesn't need any global
// middleware-ordering trick to get an unparsed body. Stripe itself
// doesn't parse the response as JSON (it only cares about the status
// code), so this is the one route where ApiError's JSON body doesn't
// actually matter to the caller — used anyway for consistency.
async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            tracing::error!("stripe webhook: missing stripe-signature header");
            ApiError::new(StatusCode::BAD_REQUEST, "missing stripe-signature header")
        })?;
    let payload = std::str::from_utf8(&body).map_err(|err| {
        tracing::error!(?err, "stripe webhook: invalid payload encoding");
        ApiError::new(StatusCode::BAD_REQUEST, "invalid payload encoding")
    })?;
    let webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();

    let completed = stripe_client::parse_checkout_completed(payload, signature, &webhook_secret)
        .map_err(|e| {
            tracing::error!(error = %e, "stripe webhook: signature/event parsing failed");
            ApiError::new(StatusCode::BAD_REQUEST, format!("Webhook Error: {e}"))
        })?;

    let Some(completed) = completed else {
        return Ok(StatusCode::OK);
    };

    let task_id: Uuid = completed.task_id.parse().map_err(|_| {
        tracing::error!(task_id = %completed.task_id, "stripe webhook: client_reference_id not a valid task_id");
        ApiError::new(StatusCode::BAD_REQUEST, "checkout session had no valid task_id")
    })?;

    let bill = bills::mark_bill_paid(
        &state.pool,
        task_id,
        PaidDetails {
            stripe_checkout_session_id: completed.checkout_session_id,
            stripe_payment_intent_id: completed.payment_intent_id,
        },
    )
    .await
    .map_err(|err| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    // None on a redelivered webhook for an already-paid bill (rustledger's
    // WHERE status = 'unpaid' guard in mark_bill_paid) — nothing new to
    // publish in that case, same idempotency posture as every Kafka
    // consumer in this stack.
    if let Some(bill) = bill {
        kafka_producer::publish_bill_event("bill.paid", &state.kafka_producer, &bill).await;
    }

    Ok(StatusCode::OK)
}
