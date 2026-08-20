use serde::Deserialize;
use uuid::Uuid;

// Fields needed to validate a bill-creation request server-side — a
// direct port of asset-service's src/task_client.rs (same unauthenticated
// internal GET, same docker-network-isolation trust posture), extended
// with owner/customer_id since asset-service's version only ever needed
// status.
#[derive(Debug, Deserialize)]
pub struct Task {
    pub status: String,
    pub owner: Option<String>,
    pub customer_id: Option<Uuid>,
}

fn base_url() -> String {
    std::env::var("TASK_SERVICE_URL")
        .unwrap_or_else(|_| "http://microverse-task-service:3000".to_string())
}

// Returns Ok(None) specifically for a 404, distinct from a real error —
// same shape as asset-service's fetch_status.
pub async fn fetch_task(task_id: &str) -> Result<Option<Task>, String> {
    let url = format!("{}/api/tasks/{task_id}", base_url());
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Err(format!("task-service returned {}", resp.status()));
    }
    let task: Task = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(task))
}
