defmodule ElixTempo.Sessions do
  @moduledoc """
  Public API for starting/pausing/resuming/stopping work sessions. Each
  transition publishes an event to the elixtempo.sessions Kafka topic —
  that's what RustLedger listens to in order to bill stopped sessions.
  """

  require Logger

  alias ElixTempo.KafkaProducer
  alias ElixTempo.Sessions.Session
  alias ElixTempo.Sessions.Store
  alias ElixTempo.TaskClient

  @doc """
  Called once at boot, from ElixTempo.Sessions.Supervisor's start_link
  — spawns a Session per still-open row in Postgres, seeded with its
  persisted raw state. No Kafka event is published here: nothing new
  happened from a business standpoint, this just puts back in memory
  what a restart took away.
  """
  def rehydrate_all do
    Store.list_open()
    |> Enum.each(&rehydrate_one/1)
  end

  defp rehydrate_one(row) do
    child = {Session, {row.id, row.analyst_id, row.quest_id, row.status, row.accumulated_seconds, row.running_since}}

    case DynamicSupervisor.start_child(ElixTempo.Sessions.Supervisor, child) do
      {:ok, _pid} ->
        :ok

      # Benign — on a genuine cold boot this can't happen (nothing is
      # alive yet when rehydrate_all runs), but rehydrate_all is safe
      # to call more than once, so a session that's already live is a
      # no-op, not a failure.
      {:error, {:already_started, _pid}} ->
        :ok

      {:error, reason} ->
        Logger.error("ElixTempo: failed to rehydrate session #{row.id}: #{inspect(reason)}")
        :ok
    end
  end

  @doc """
  Aggregate worked hours for an analyst — stopped sessions only,
  grouped by quest_id, plus a running total. This is Phase 3's query
  surface: what Payouts' "hourly off elixtempo's tracked time" basis
  reads. `opts` takes `:from`/`:to` (DateTime or nil) to bound on when
  a session stopped.
  """
  def hours_for(analyst_id, opts \\ []) do
    from = Keyword.get(opts, :from)
    to = Keyword.get(opts, :to)

    by_quest = Store.hours_for(analyst_id, from, to)

    %{
      analyst_id: analyst_id,
      total_seconds: Enum.reduce(by_quest, 0, &(&1.seconds + &2)),
      session_count: Enum.reduce(by_quest, 0, &(&1.session_count + &2)),
      by_quest: by_quest
    }
  end

  @doc """
  Starting a session validates quest_id against task-service — its
  existence and that the caller (by email; task-service's assignee is
  an email, not a sub) is the currently-assigned analyst on it, status
  'analyst'. Checked once, here, not re-checked by pause/resume/stop —
  a task getting reassigned mid-session is an edge case explicitly out
  of scope for this pass (see docs/roadmap/1.1/domain-services.md's
  Phase 4).
  """
  def start_session(analyst_id, quest_id, caller_email) do
    with :ok <- validate_quest(quest_id, caller_email) do
      id = Uniq.UUID.uuid4()

      case DynamicSupervisor.start_child(
             ElixTempo.Sessions.Supervisor,
             {Session, {id, analyst_id, quest_id}}
           ) do
        {:ok, _pid} ->
          {:ok, view} = Session.view(id)
          Store.upsert(view)
          publish(view, "session.started")
          {:ok, view}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp validate_quest(quest_id, caller_email) do
    case TaskClient.fetch_task(quest_id) do
      {:ok, nil} -> {:error, :quest_not_found}
      {:ok, %{"status" => "analyst", "assignee" => ^caller_email}} -> :ok
      {:ok, %{"status" => "analyst"}} -> {:error, :not_assigned}
      {:ok, _task} -> {:error, :quest_not_assignable}
      {:error, _reason} -> {:error, :task_service_unavailable}
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
        Store.upsert(view)
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
