mod api;
mod auth;
mod billing;
mod db;
mod kafka_consumer;
mod models;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let kafka_brokers = std::env::var("KAFKA_BROKERS")
        .unwrap_or_else(|_| "microverse-kafka:9092".to_string())
        .split(',')
        .map(str::to_string)
        .collect::<Vec<_>>();
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8080);

    let pool = loop {
        match db::connect(&database_url).await {
            Ok(pool) => break pool,
            Err(err) => {
                tracing::warn!(?err, "database not reachable yet, retrying in 5s");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    };

    tokio::spawn(kafka_consumer::run(kafka_brokers, pool.clone()));

    let app = api::router(pool);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("failed to bind listener");

    tracing::info!(port, "rustledger listening");
    axum::serve(listener, app).await.expect("server error");
}
