use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Json};
use axum::routing::{get, patch, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::claims_from_headers;
use crate::billing::RateCard;
use crate::bills::{self, NewBill, PaidDetails};
use crate::models::{AnalystTotal, Bill, LineItem};

// Full ledger visibility (any analyst's line items/totals) is billing
// data with no access-control design yet — Branch 9 in ROADMAP.md
// leaves "who can see whose billing" an open question. platform:admin
// is a conservative interim gate to close the OWASP A01 finding
// (docs/security.md: rustledger had zero auth, unlike every other
// service) without guessing at that unbuilt design; revisit once
// Branch 9's payout-visibility model actually exists.
fn require_admin(headers: &HeaderMap) -> Result<(), (StatusCode, String)> {
    require_any_role(headers, &["platform:admin"])
}

// Generalized for the bills endpoints below, which need PM/customer/admin
// combinations rather than admin-only — same claim-extraction, just a
// list of acceptable roles instead of one.
fn require_any_role(headers: &HeaderMap, roles: &[&str]) -> Result<(), (StatusCode, String)> {
    let claims = claims_from_headers(headers)
        .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed token".into()))?;
    if !roles.iter().any(|role| claims.has_role(role)) {
        return Err((
            StatusCode::FORBIDDEN,
            format!("requires one of: {}", roles.join(", ")),
        ));
    }
    Ok(())
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/line-items", get(list_line_items))
        .route("/api/analysts/{analyst_id}/total", get(analyst_total))
        .route("/api/bills", post(create_bill))
        .route("/api/bills/by-task/{task_id}", get(get_bill_by_task))
        .route("/api/bills/{task_id}/mark-paid", patch(mark_bill_paid))
        .with_state(AppState { pool })
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
    customer_id: Uuid,
    amount_cents: i64,
    currency: String,
}

// billing-service is the only intended caller — it's already done the
// real work (fetched the task, checked owner/status, resolved
// customer_id) before this request arrives, so rustledger just persists
// what it's told rather than re-deriving it from a task-service it has
// no client for.
async fn create_bill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateBillBody>,
) -> Result<Json<Bill>, (StatusCode, String)> {
    require_any_role(&headers, &["platform:project-manager", "platform:admin"])?;

    bills::create_bill(
        &state.pool,
        NewBill {
            task_id: body.task_id,
            customer_id: body.customer_id,
            amount_cents: body.amount_cents,
            currency: body.currency,
        },
    )
    .await
    .map(Json)
    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

async fn get_bill_by_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Bill>, (StatusCode, String)> {
    // Customer-ownership scoping (a customer may only fetch their own
    // bill) happens in billing-service, which knows the caller's
    // identity against the bill's customer_id — this gate is just
    // "some recognized role," same interim posture as require_admin
    // above.
    require_any_role(
        &headers,
        &["platform:project-manager", "platform:customer", "platform:admin"],
    )?;

    bills::get_bill_by_task(&state.pool, task_id)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?
        .map(Json)
        .ok_or((StatusCode::NOT_FOUND, "no bill for that task".into()))
}

#[derive(Deserialize)]
struct MarkPaidBody {
    stripe_checkout_session_id: String,
    stripe_payment_intent_id: String,
}

#[derive(Serialize)]
struct MarkPaidResponse {
    bill: Option<Bill>,
}

// No role gate — internal-network trust only, same posture as
// asset-service's task_client.rs. This is called from billing-service's
// Stripe webhook handler, which has no end-user JWT to forward (Stripe
// itself is the caller from billing-service's perspective). Revisit if
// this network boundary ever needs to be crossed by anything less
// trusted than another Microverse service on the same docker network.
async fn mark_bill_paid(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    Json(body): Json<MarkPaidBody>,
) -> Result<Json<MarkPaidResponse>, (StatusCode, String)> {
    bills::mark_bill_paid(
        &state.pool,
        task_id,
        PaidDetails {
            stripe_checkout_session_id: body.stripe_checkout_session_id,
            stripe_payment_intent_id: body.stripe_payment_intent_id,
        },
    )
    .await
    .map(|bill| Json(MarkPaidResponse { bill }))
    .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}
