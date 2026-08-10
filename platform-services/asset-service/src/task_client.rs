use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Task {
    pub status: String,
}

fn base_url() -> String {
    std::env::var("TASK_SERVICE_URL")
        .unwrap_or_else(|_| "http://microverse-task-service:3000".to_string())
}

// Called synchronously on every download-URL request rather than
// trusting a cached copy — correctness matters more than shaving a
// network hop off a request that isn't a hot path (ROADMAP.md's
// MinIO proposal, "The two auth paths are different in kind").
//
// Returns Ok(None) specifically for a 404 — distinct from a real
// error — so callers that also serve the pre-submit compose phase
// (upload_url: a file can be attached before CreateOrderForm's
// POST /api/tasks has created the row yet) can tell "no task yet" apart
// from "task-service is unreachable/erroring" and treat only the
// former as fine.
pub async fn fetch_status(order_id: &str) -> Result<Option<String>, String> {
    let url = format!("{}/api/tasks/{order_id}", base_url());
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Err(format!("task-service returned {}", resp.status()));
    }
    let task: Task = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(task.status))
}
