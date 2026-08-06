use axum::extract::{Path, Query};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::auth::claims_from_headers;
use crate::{minio, task_client};

// Deviates from ROADMAP.md's originally-sketched shape in two small,
// necessary ways:
//  - `service` is an explicit request field/query param everywhere,
//    not inferred from the object key or a lookup — there's no
//    cross-service order registry to resolve "which service does this
//    order_id belong to," so whoever's calling (which already knows
//    it's dealing with, say, a gofeeler task) has to say so.
//  - Listing/download resolve the exact object by scanning the
//    service's objects and filtering for this order_id (see
//    minio::list_order_objects) rather than a direct key lookup,
//    since `company_id` (here: username) sits before `order_id` in
//    the key and there's no way to know a customer's username from
//    the order_id alone without a real order-service to ask.
pub fn router() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/assets/upload-url", post(upload_url))
        .route("/assets/{order_id}/download-url", get(download_url))
        .route("/assets/{order_id}", get(list_assets))
}

async fn health() -> impl IntoResponse {
    StatusCode::OK
}

fn expires_at(ttl: Duration) -> u64 {
    (SystemTime::now() + ttl)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[derive(Deserialize)]
struct UploadUrlRequest {
    service: String,
    order_id: String,
    filename: String,
    content_type: String,
}

#[derive(Serialize)]
struct UploadUrlResponse {
    upload_url: String,
    object_key: String,
    expires_at: u64,
}

// Auth: platform:customer + service:{x}. No order-ownership check yet
// (ROADMAP.md calls for one) — there's no order-service to own that
// record against; the order doesn't exist anywhere until the Create
// Order form actually submits (Branch 3's own unfinished piece).
async fn upload_url(
    headers: HeaderMap,
    Json(body): Json<UploadUrlRequest>,
) -> Result<Json<UploadUrlResponse>, (StatusCode, String)> {
    let claims = claims_from_headers(&headers)
        .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed token".into()))?;

    if !claims.has_role("platform:customer") {
        return Err((StatusCode::FORBIDDEN, "requires platform:customer".into()));
    }
    let service_role = format!("service:{}", body.service);
    if !claims.has_role(&service_role) {
        return Err((StatusCode::FORBIDDEN, format!("requires {service_role}")));
    }
    let username = claims
        .username()
        .ok_or((StatusCode::UNAUTHORIZED, "token has no preferred_username".into()))?;

    let key = minio::object_key(&body.service, username, &body.order_id, &body.filename);
    minio::ensure_bucket(&minio::internal_client().await).await;

    let upload_url = minio::presigned_put_url(&minio::presign_client().await, &key, &body.content_type)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UploadUrlResponse {
        upload_url,
        object_key: key,
        expires_at: expires_at(Duration::from_secs(15 * 60)),
    }))
}

#[derive(Deserialize)]
struct DownloadUrlQuery {
    filename: String,
    service: String,
}

#[derive(Serialize)]
struct DownloadUrlResponse {
    download_url: String,
    expires_at: u64,
}

const STAFF_ROLES: [&str; 3] = [
    "platform:project-manager",
    "platform:analyst",
    "platform:reviewer",
];

// Auth is role AND status, not just role (ROADMAP.md's "paid unlocks
// download"): staff with the matching service scope can always
// download (they need the raw content to do the work); a customer
// only once the task's current status is paid/closed, checked live
// against task-service on every request rather than a cached copy.
async fn download_url(
    headers: HeaderMap,
    Path(order_id): Path<String>,
    Query(query): Query<DownloadUrlQuery>,
) -> Result<Json<DownloadUrlResponse>, (StatusCode, String)> {
    let claims = claims_from_headers(&headers)
        .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed token".into()))?;
    let service_role = format!("service:{}", query.service);
    if !claims.has_role(&service_role) {
        return Err((StatusCode::FORBIDDEN, format!("requires {service_role}")));
    }

    let is_staff = STAFF_ROLES.iter().any(|r| claims.has_role(r));
    let is_customer = claims.has_role("platform:customer");

    if !is_staff && !is_customer {
        return Err((StatusCode::FORBIDDEN, "no eligible platform role".into()));
    }

    let objects = minio::list_order_objects(&minio::internal_client().await, &query.service, &order_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let matching_key = objects
        .into_iter()
        .find_map(|obj| obj.key)
        .filter(|k| k.ends_with(&format!("/{}", query.filename)))
        .ok_or((StatusCode::NOT_FOUND, "no matching file for this order".into()))?;

    if is_customer && !is_staff {
        let username = claims
            .username()
            .ok_or((StatusCode::UNAUTHORIZED, "token has no preferred_username".into()))?;
        if !matching_key.contains(&format!("/{username}/")) {
            return Err((StatusCode::FORBIDDEN, "not this customer's order".into()));
        }

        let status = task_client::fetch_status(&order_id)
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
        if !matches!(status.as_str(), "paid" | "closed") {
            return Err((
                StatusCode::FORBIDDEN,
                "download unlocks once the order is paid".into(),
            ));
        }
    }

    let download_url = minio::presigned_get_url(&minio::presign_client().await, &matching_key)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(DownloadUrlResponse {
        download_url,
        expires_at: expires_at(Duration::from_secs(15 * 60)),
    }))
}

#[derive(Deserialize)]
struct ListAssetsQuery {
    service: String,
}

#[derive(Serialize)]
struct AssetSummary {
    filename: String,
    size: i64,
    uploaded_at: Option<String>,
}

// No per-file content_type/version in this listing — that'd need a
// HeadObject call per object (an N+1 the dummy-scale dev data doesn't
// justify yet) or a real metadata table (which the "stateless-first"
// approach explicitly defers). Filename/size/uploaded_at come straight
// off ListObjectsV2.
async fn list_assets(
    headers: HeaderMap,
    Path(order_id): Path<String>,
    Query(query): Query<ListAssetsQuery>,
) -> Result<Json<Vec<AssetSummary>>, (StatusCode, String)> {
    let claims = claims_from_headers(&headers)
        .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed token".into()))?;
    let service_role = format!("service:{}", query.service);
    if !claims.has_role(&service_role) {
        return Err((StatusCode::FORBIDDEN, format!("requires {service_role}")));
    }

    let objects = minio::list_order_objects(&minio::internal_client().await, &query.service, &order_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let summaries = objects
        .into_iter()
        .filter_map(|obj| {
            let key = obj.key?;
            let filename = key.rsplit('/').next().unwrap_or(&key).to_string();
            Some(AssetSummary {
                filename,
                size: obj.size.unwrap_or(0),
                uploaded_at: obj.last_modified.map(|t| t.to_string()),
            })
        })
        .collect::<Vec<_>>();

    Ok(Json(summaries))
}
