defmodule ElixTempo.KafkaProducer do
  @moduledoc """
  Thin wrapper around :brod for publishing session lifecycle events to the
  elixtempo.sessions topic. RustLedger consumes "session.stopped" events
  from this same topic to turn tracked work-time into billed line items —
  this is the only thing that connects the two services.
  """

  @client_id :elixtempo_kafka_client
  @topic "elixtempo.sessions"

  def start_client do
    :ok = :brod.start_client(brokers_from_env(), @client_id, client_config())
    :ok = :brod.start_producer(@client_id, @topic, _producer_config = [])
    :ok
  end

  @doc "Publishes a session lifecycle event. Keyed by session_id so all events for a session land on the same partition, in order."
  def publish(%{session_id: session_id} = event) do
    value = Jason.encode!(event)
    :brod.produce_sync(@client_id, @topic, 0, session_id, value)
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
