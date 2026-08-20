defmodule ElixTempo.Sessions.Store do
  @moduledoc """
  Postgres write-behind for session state — own `elixtempo` schema on
  the shared microverse-postgis instance, same one-schema-per-service
  convention as rustledger/task-service. This is what lets a session's
  state survive a restart (see ElixTempo.Application's rehydrate step)
  instead of the Kafka event log doing double duty as a queryable
  source of truth.

  Schema is ensured synchronously inside start_link, and this is child
  #1 in the supervision tree — ahead of the Endpoint — so no request
  can ever race a CREATE TABLE that hasn't finished yet.
  """

  @name __MODULE__

  def child_spec(opts) do
    %{id: __MODULE__, start: {__MODULE__, :start_link, [opts]}}
  end

  def start_link(_opts) do
    case Postgrex.start_link(Keyword.put(connection_opts(), :name, @name)) do
      {:ok, pid} ->
        ensure_schema!()
        {:ok, pid}

      error ->
        error
    end
  end

  @doc false
  def ensure_schema! do
    Postgrex.query!(@name, "CREATE SCHEMA IF NOT EXISTS elixtempo", [])

    Postgrex.query!(
      @name,
      """
      CREATE TABLE IF NOT EXISTS elixtempo.sessions (
        id                  TEXT PRIMARY KEY,
        analyst_id          TEXT NOT NULL,
        quest_id            TEXT NOT NULL,
        status              TEXT NOT NULL,
        accumulated_seconds BIGINT NOT NULL DEFAULT 0,
        running_since       TIMESTAMPTZ,
        inserted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
      """,
      []
    )

    :ok
  end

  @doc "Upserts a session's current raw state — called after every successful transition."
  def upsert(view) do
    Postgrex.query!(
      @name,
      """
      INSERT INTO elixtempo.sessions
        (id, analyst_id, quest_id, status, accumulated_seconds, running_since, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        accumulated_seconds = EXCLUDED.accumulated_seconds,
        running_since = EXCLUDED.running_since,
        updated_at = now()
      """,
      [
        view.id,
        view.analyst_id,
        view.quest_id,
        Atom.to_string(view.status),
        view.accumulated_seconds,
        view.running_since
      ]
    )

    :ok
  end

  defp connection_opts do
    url = System.get_env("DATABASE_URL") || "postgres://postgres:postgres@localhost:5432/microverse"
    uri = URI.parse(url)

    {username, password} =
      case String.split(uri.userinfo || "", ":", parts: 2) do
        [u, p] -> {u, p}
        [u] -> {u, nil}
        _ -> {nil, nil}
      end

    [
      hostname: uri.host,
      port: uri.port || 5432,
      username: username,
      password: password,
      database: String.trim_leading(uri.path || "", "/"),
      pool_size: 5
    ]
  end
end
