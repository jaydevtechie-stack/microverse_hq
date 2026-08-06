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
pub async fn fetch_status(order_id: &str) -> Result<String, String> {
    let url = format!("{}/api/tasks/{order_id}", base_url());
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("task-service returned {}", resp.status()));
    }
    let task: Task = resp.json().await.map_err(|e| e.to_string())?;
    Ok(task.status)
}
