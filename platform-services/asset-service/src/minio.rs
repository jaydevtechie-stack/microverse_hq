use std::time::Duration;

use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::Client;

const PRESIGN_TTL: Duration = Duration::from_secs(15 * 60);

async fn client_for(endpoint: String) -> Client {
    let region = std::env::var("AWS_REGION").unwrap_or_else(|_| "us-west-2".to_string());

    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(aws_sdk_s3::config::Region::new(region))
        .endpoint_url(endpoint)
        .load()
        .await;

    // MinIO is path-style only (bucket.minio.local doesn't resolve to
    // anything) — the AWS SDK defaults to virtual-hosted style, which
    // silently fails against it.
    let s3_config = aws_sdk_s3::config::Builder::from(&config)
        .force_path_style(true)
        .build();

    Client::from_conf(s3_config)
}

// Two clients, two different jobs — conflating them is what broke
// list/head/create-bucket earlier:
//   - presign_client talks to the PUBLIC endpoint (S3_ENDPOINT,
//     storage.microverse.local). Presigning is a pure local signature
//     computation, no real network call, so it doesn't matter that
//     this host isn't resolvable from inside the container.
//   - internal_client talks to MinIO directly over the Docker network
//     (S3_INTERNAL_ENDPOINT) for calls that need an actual response:
//     list_objects_v2, head_bucket, create_bucket. storage.microverse.local
//     only resolves on the host machine's /etc/hosts, not in here.
pub async fn presign_client() -> Client {
    let endpoint = std::env::var("S3_ENDPOINT").expect("S3_ENDPOINT must be set");
    client_for(endpoint).await
}

pub async fn internal_client() -> Client {
    let endpoint = std::env::var("S3_INTERNAL_ENDPOINT")
        .unwrap_or_else(|_| "http://microverse-minio:9000".to_string());
    client_for(endpoint).await
}

pub fn bucket_name() -> String {
    std::env::var("ASSETS_BUCKET_NAME").unwrap_or_else(|_| "microverse-assets".to_string())
}

// One shared bucket, isolation via key structure (see ROADMAP.md's
// MinIO proposal): {service}/{username}/{order_id}/v1/{filename}.
// "v1" is a fixed literal, not an incrementing counter — actual
// version history is MinIO's native object versioning on this same
// key, not encoded in the path (per the proposal's own Versioning
// note — re-uploading replaces this same key, it doesn't mint a v2
// path). `username` stands in for the proposal's `company_id`: there's
// no company entity anywhere in the stack yet, just Keycloak users.
pub fn object_key(service: &str, username: &str, order_id: &str, filename: &str) -> String {
    format!("{service}/{username}/{order_id}/v1/{filename}")
}

pub async fn ensure_bucket(client: &Client) {
    let bucket = bucket_name();
    if client.head_bucket().bucket(&bucket).send().await.is_err() {
        let _ = client.create_bucket().bucket(&bucket).send().await;
    }
}

pub async fn presigned_put_url(
    client: &Client,
    key: &str,
    content_type: &str,
) -> Result<String, aws_sdk_s3::Error> {
    let presign_config = PresigningConfig::expires_in(PRESIGN_TTL).expect("valid TTL");
    let req = client
        .put_object()
        .bucket(bucket_name())
        .key(key)
        .content_type(content_type)
        .presigned(presign_config)
        .await?;
    Ok(req.uri().to_string())
}

pub async fn presigned_get_url(client: &Client, key: &str) -> Result<String, aws_sdk_s3::Error> {
    let presign_config = PresigningConfig::expires_in(PRESIGN_TTL).expect("valid TTL");
    let req = client
        .get_object()
        .bucket(bucket_name())
        .key(key)
        .presigned(presign_config)
        .await?;
    Ok(req.uri().to_string())
}

// No metadata table for file listing (stateless-first, per ROADMAP.md)
// — ListObjectsV2 under the service prefix, filtered in memory for
// this order_id. Fine at current scale; would need either a real
// index or reordering the key (order_id before username) to stay a
// cheap prefix-only lookup once object counts actually grow.
pub async fn list_order_objects(
    client: &Client,
    service: &str,
    order_id: &str,
) -> Result<Vec<aws_sdk_s3::types::Object>, aws_sdk_s3::Error> {
    let prefix = format!("{service}/");
    let resp = client
        .list_objects_v2()
        .bucket(bucket_name())
        .prefix(&prefix)
        .send()
        .await?;

    let needle = format!("/{order_id}/");
    Ok(resp
        .contents
        .unwrap_or_default()
        .into_iter()
        .filter(|obj| obj.key.as_deref().is_some_and(|k| k.contains(&needle)))
        .collect())
}
