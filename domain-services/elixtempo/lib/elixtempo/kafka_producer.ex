defmodule ElixTempo.KafkaProducer do
  @moduledoc """
  Thin wrapper around :brod for publishing session lifecycle events to the
  elixtempo.sessions topic. RustLedger consumes "session.stopped" events
  from this same topic to turn tracked work-time into billed line items —
  this is the only thing that connects the two services.

  Runs as its own supervised GenServer rather than connecting synchronously
  in ElixTempo.Application.start/2 — a `:brod.start_client` call that fails
  because Kafka isn't accepting connections *yet* (a startup-order race:
  docker-compose's `depends_on` only waits for the Kafka container to
  start, not for the broker inside it to actually be ready) used to hard
  crash the whole OTP application (`:ok = ` pattern match on an `{:error,
  {:client_down, ...}}` tuple), taking the whole container down with it.
  Every other Kafka-touching service in this stack (rustledger's
  kafka_producer.rs, task-service/notification-service/audit-service's
  kafka-consumer.js) already connects in the background with a retry
  instead of blocking/crashing startup on it — this brings elixtempo in
  line with that same posture.
  """
  use GenServer
  require Logger

  @client_id :elixtempo_kafka_client
  @topic "elixtempo.sessions"
  @retry_after :timer.seconds(5)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @impl true
  def init(:ok) do
    send(self(), :connect)
    {:ok, %{}}
  end

  @impl true
  def handle_info(:connect, state) do
    case do_connect() do
      :ok ->
        {:noreply, state}

      {:error, reason} ->
        Logger.error("kafka client failed to start, retrying in #{@retry_after}ms: #{inspect(reason)}")
        Process.send_after(self(), :connect, @retry_after)
        {:noreply, state}
    end
  end

  defp do_connect do
    with :ok <- :brod.start_client(brokers_from_env(), @client_id, client_config()),
         :ok <- :brod.start_producer(@client_id, @topic, _producer_config = []) do
      :ok
    end
  end

  @doc """
  Publishes a session lifecycle event. Keyed by session_id so all events
  for a session land on the same partition, in order.

  Best-effort, same posture as every other producer in this stack — a
  failure (including the client still being mid-retry from init/1 above)
  is logged and swallowed rather than propagated to the caller, which
  would otherwise fail the session pause/resume/stop request itself over
  what's just an analytics/billing side effect.
  """
  def publish(%{session_id: session_id, event: event_name} = event) do
    value = Jason.encode!(event)

    case :brod.produce_sync(@client_id, @topic, 0, session_id, value) do
      :ok ->
        :ok

      {:error, reason} ->
        Logger.error("failed to publish #{event_name} for session #{session_id}: #{inspect(reason)}")
        :ok
    end
  rescue
    e ->
      Logger.error("failed to publish #{event_name} for session #{session_id}: #{Exception.message(e)}")
      :ok
  catch
    :exit, reason ->
      Logger.error("failed to publish #{event_name} for session #{session_id}: #{inspect(reason)}")
      :ok
  end

  defp brokers_from_env do
    "KAFKA_BROKERS"
    |> System.get_env("microverse-kafka:9092")
    |> String.split(",")
    |> Enum.map(fn entry ->
      [host, port] = String.split(entry, ":")
      {host, String.to_integer(port)}
    end)
  end

  defp client_config do
    # topic may not exist yet on a fresh broker — let brod create it rather
    # than requiring RustLedger (or an operator) to have done so first
    [allow_topic_auto_creation: true]
  end
end
