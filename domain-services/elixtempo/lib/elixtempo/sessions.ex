defmodule ElixTempo.Sessions do
  @moduledoc """
  Public API for starting/pausing/resuming/stopping work sessions. Each
  transition publishes an event to the elixtempo.sessions Kafka topic —
  that's what RustLedger listens to in order to bill stopped sessions.
  """

  alias ElixTempo.KafkaProducer
  alias ElixTempo.Sessions.Session

  def start_session(analyst_id, quest_id) do
    id = Uniq.UUID.uuid4()

    case DynamicSupervisor.start_child(
           ElixTempo.Sessions.Supervisor,
           {Session, {id, analyst_id, quest_id}}
         ) do
      {:ok, _pid} ->
        {:ok, view} = Session.view(id)
        publish(view, "session.started")
        {:ok, view}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def pause_session(id), do: transition(id, &Session.pause/1, "session.paused")
  def resume_session(id), do: transition(id, &Session.resume/1, "session.resumed")
  def stop_session(id), do: transition(id, &Session.stop/1, "session.stopped")

  def get_session(id) do
    Session.view(id)
  catch
    :exit, _ -> {:error, :not_found}
  end

  defp transition(id, fun, event_name) do
    case fun.(id) do
      {:ok, view} ->
        publish(view, event_name)
        {:ok, view}

      {:error, reason} ->
        {:error, reason}
    end
  catch
    :exit, _ -> {:error, :not_found}
  end

  defp publish(view, event_name) do
    KafkaProducer.publish(%{
      event: event_name,
      session_id: view.id,
      analyst_id: view.analyst_id,
      quest_id: view.quest_id,
      occurred_at: DateTime.utc_now(),
      elapsed_seconds: view.elapsed_seconds
    })
  end
end
