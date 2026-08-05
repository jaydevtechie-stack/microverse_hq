use sqlx::PgPool;

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let pool = PgPool::connect(database_url).await?;
    ensure_schema(&pool).await?;
    Ok(pool)
}

async fn ensure_schema(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("CREATE SCHEMA IF NOT EXISTS rustledger")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS rustledger.line_items (
            id                   UUID PRIMARY KEY,
            session_id           TEXT NOT NULL,
            analyst_id           TEXT NOT NULL,
            quest_id             TEXT NOT NULL,
            elapsed_seconds      BIGINT NOT NULL,
            rate_cents_per_hour  BIGINT NOT NULL,
            amount_cents         BIGINT NOT NULL,
            currency             TEXT NOT NULL,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // session_id is unique per unit of work — guards against double-billing
    // if Kafka redelivers a "session.stopped" event
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS line_items_session_id_key \
         ON rustledger.line_items (session_id)",
    )
    .execute(pool)
    .await?;

    Ok(())
}
