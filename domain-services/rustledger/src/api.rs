use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use sqlx::PgPool;

use crate::billing::RateCard;
use crate::models::{AnalystTotal, LineItem};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/line-items", get(list_line_items))
        .route("/api/analysts/{analyst_id}/total", get(analyst_total))
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
    Query(query): Query<LineItemsQuery>,
) -> Result<Json<Vec<LineItem>>, (StatusCode, String)> {
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
    Path(analyst_id): Path<String>,
) -> Result<Json<AnalystTotal>, (StatusCode, String)> {
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
