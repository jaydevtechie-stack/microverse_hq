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
        .route("/assets/{order_id}", get(list_assets).delete(delete_asset))
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

// Auth: platform:customer + service:{x}. Ownership itself doesn't need
// a task-service round-trip — the object key is always built from the
// caller's own username (below), so nobody can ever mint an upload URL
// under someone else's key namespace regardless of which order_id they
// pass. What does need checking is status: this same endpoint serves
// two phases — pre-submit compose (task row doesn't exist yet, files
// upload before CreateOrderForm's POST /api/tasks) and post-submit
// editing (task row exists). fetch_status's None case is exactly the
// former; Some(status) other than "unassigned" means the order's
// already moving and the customer's edit window (see docs/roadmap's
// Branch 5 follow-up) has closed.
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

    if let Some(status) = task_client::fetch_status(&body.order_id)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?
    {
        if status != "unassigned" {
            return Err((
                StatusCode::FORBIDDEN,
                "files can only be added while the order is unassigned".into(),
            ));
        }
    }

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

    // filter_map then find, not find_map then filter — the latter grabs
    // whichever object happens to be first in the listing and only then
    // checks if it matches, so it 404s on anything but the first file
    // for any order with more than one attachment.
    let matching_key = objects
        .into_iter()
        .filter_map(|obj| obj.key)
        .find(|k| k.ends_with(&format!("/{}", query.filename)))
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
            .map_err(|e| (StatusCode::BAD_GATEWAY, e))?
            .ok_or((StatusCode::NOT_FOUND, "order not found".into()))?;
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
//
// Ownership check added to close the OWASP A01 finding (docs/security.md)
// that this was the one of the three near-identical handlers skipping it
// — download_url/delete_asset both check the key's username segment.
// A customer here gets the list filtered to their own username segment
// rather than a hard 403 on "no match": unlike download (which always
// targets one specific filename), an empty result is the legitimate
// state for a customer's own order before they've uploaded anything, and
// a 403 there would wrongly read as "not your order."
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

    let is_staff = STAFF_ROLES.iter().any(|r| claims.has_role(r));
    let is_customer = claims.has_role("platform:customer");
    if !is_staff && !is_customer {
        return Err((StatusCode::FORBIDDEN, "no eligible platform role".into()));
    }

    let objects = minio::list_order_objects(&minio::internal_client().await, &query.service, &order_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let owned_prefix = if is_customer && !is_staff {
        let username = claims
            .username()
            .ok_or((StatusCode::UNAUTHORIZED, "token has no preferred_username".into()))?;
        Some(format!("/{username}/"))
    } else {
        None
    };

    let summaries = objects
        .into_iter()
        .filter_map(|obj| {
            let key = obj.key?;
            if owned_prefix.as_ref().is_some_and(|prefix| !key.contains(prefix.as_str())) {
                return None;
            }
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

#[derive(Deserialize)]
struct DeleteAssetQuery {
    service: String,
    filename: String,
}

// Customer-only (mirrors upload_url), same unassigned-only edit window,
// same self-scoped ownership check as download_url (the key's own
// username segment, not a task-service round-trip for identity).
// Permanent delete — no soft-delete/orphan bookkeeping, matching
// asset-service's stateless-first design (no metadata table to keep in
// sync either way).
async fn delete_asset(
    headers: HeaderMap,
    Path(order_id): Path<String>,
    Query(query): Query<DeleteAssetQuery>,
) -> Result<StatusCode, (StatusCode, String)> {
    let claims = claims_from_headers(&headers)
        .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed token".into()))?;

    if !claims.has_role("platform:customer") {
        return Err((StatusCode::FORBIDDEN, "requires platform:customer".into()));
    }
    let service_role = format!("service:{}", query.service);
    if !claims.has_role(&service_role) {
        return Err((StatusCode::FORBIDDEN, format!("requires {service_role}")));
    }
    let username = claims
        .username()
        .ok_or((StatusCode::UNAUTHORIZED, "token has no preferred_username".into()))?;

    let status = task_client::fetch_status(&order_id)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?
        .ok_or((StatusCode::NOT_FOUND, "order not found".into()))?;
    if status != "unassigned" {
        return Err((
            StatusCode::FORBIDDEN,
            "files can only be removed while the order is unassigned".into(),
        ));
    }

    let objects = minio::list_order_objects(&minio::internal_client().await, &query.service, &order_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let matching_key = objects
        .into_iter()
        .filter_map(|obj| obj.key)
        .find(|k| k.ends_with(&format!("/{}", query.filename)))
        .ok_or((StatusCode::NOT_FOUND, "no matching file for this order".into()))?;

    if !matching_key.contains(&format!("/{username}/")) {
        return Err((StatusCode::FORBIDDEN, "not this customer's order".into()));
    }

    minio::delete_object(&minio::internal_client().await, &matching_key)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
