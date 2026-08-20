defmodule ElixTempo.SessionsTest do
  use ExUnit.Case, async: false

  alias ElixTempo.Sessions
  alias ElixTempo.Sessions.Store

  test "start_session returns a running view and get_session returns the same session" do
    {:ok, started} = Sessions.start_session("analyst-1", "quest-1")

    assert started.analyst_id == "analyst-1"
    assert started.quest_id == "quest-1"
    assert started.status == :running
    assert started.elapsed_seconds >= 0

    assert {:ok, fetched} = Sessions.get_session(started.id)
    assert fetched.id == started.id
    assert fetched.status == :running
  end

  test "pause then resume round-trips status without losing accumulated time" do
    {:ok, %{id: id}} = Sessions.start_session("analyst-a", "quest-a")

    assert {:ok, paused} = Sessions.pause_session(id)
    assert paused.status == :paused

    assert {:ok, resumed} = Sessions.resume_session(id)
    assert resumed.status == :running
    assert resumed.elapsed_seconds >= paused.elapsed_seconds
  end

  test "pausing an already-paused session errors instead of double-pausing" do
    {:ok, %{id: id}} = Sessions.start_session("analyst-b", "quest-b")
    {:ok, _} = Sessions.pause_session(id)

    assert Sessions.pause_session(id) == {:error, :not_running}
  end

  test "resuming a running session errors" do
    {:ok, %{id: id}} = Sessions.start_session("analyst-c", "quest-c")

    assert Sessions.resume_session(id) == {:error, :not_paused}
  end

  test "stop terminates the session — it can no longer be found afterward" do
    {:ok, %{id: id}} = Sessions.start_session("analyst-d", "quest-d")

    assert {:ok, stopped} = Sessions.stop_session(id)
    assert stopped.status == :stopped
    assert Sessions.get_session(id) == {:error, :not_found}
  end

  test "every transition write-behinds to the sessions table" do
    {:ok, %{id: id}} = Sessions.start_session("analyst-e", "quest-e")
    assert %Postgrex.Result{rows: [["running", 0]]} = row(id, "status, accumulated_seconds")

    {:ok, _} = Sessions.pause_session(id)
    assert %Postgrex.Result{rows: [["paused"]]} = row(id, "status")

    {:ok, _} = Sessions.stop_session(id)
    assert %Postgrex.Result{rows: [["stopped"]]} = row(id, "status")
  end

  defp row(id, columns) do
    Postgrex.query!(Store, "SELECT #{columns} FROM elixtempo.sessions WHERE id = $1", [id])
  end

  # Deletes the row directly (not via Sessions.stop_session) — these
  # tests inject synthetic rows straight into Postgres to simulate
  # "a session existed before this boot," and cleaning up through the
  # real API would publish a genuine session.stopped Kafka event that
  # RustLedger's live consumer would bill as if it were real work.
  defp cleanup_row(id), do: Postgrex.query(Store, "DELETE FROM elixtempo.sessions WHERE id = $1", [id])

  test "rehydrate_all restores a running session from a Postgres row with no live process" do
    id = Uniq.UUID.uuid4()
    on_exit(fn -> cleanup_row(id) end)
    running_since = DateTime.utc_now() |> DateTime.add(-120, :second) |> DateTime.truncate(:second)

    Store.upsert(%{
      id: id,
      analyst_id: "analyst-rehydrate-running",
      quest_id: "quest-rehydrate",
      status: :running,
      accumulated_seconds: 30,
      running_since: running_since
    })

    assert Sessions.get_session(id) == {:error, :not_found}

    Sessions.rehydrate_all()

    assert {:ok, view} = Sessions.get_session(id)
    assert view.status == :running
    assert view.elapsed_seconds >= 150
  end

  test "rehydrate_all restores a paused session with its accumulated time frozen" do
    id = Uniq.UUID.uuid4()
    on_exit(fn -> cleanup_row(id) end)

    Store.upsert(%{
      id: id,
      analyst_id: "analyst-rehydrate-paused",
      quest_id: "quest-rehydrate",
      status: :paused,
      accumulated_seconds: 90,
      running_since: nil
    })

    Sessions.rehydrate_all()

    assert {:ok, view} = Sessions.get_session(id)
    assert view.status == :paused
    assert view.elapsed_seconds == 90
  end

  test "rehydrate_all does not resurrect a stopped session" do
    id = Uniq.UUID.uuid4()
    on_exit(fn -> cleanup_row(id) end)

    Store.upsert(%{
      id: id,
      analyst_id: "analyst-rehydrate-stopped",
      quest_id: "quest-rehydrate",
      status: :stopped,
      accumulated_seconds: 10,
      running_since: nil
    })

    Sessions.rehydrate_all()

    assert Sessions.get_session(id) == {:error, :not_found}
  end

  defp seed_stopped(analyst_id, quest_id, seconds) do
    Store.upsert(%{
      id: Uniq.UUID.uuid4(),
      analyst_id: analyst_id,
      quest_id: quest_id,
      status: :stopped,
      accumulated_seconds: seconds,
      running_since: nil
    })
  end

  defp seed_running(analyst_id, quest_id, seconds) do
    Store.upsert(%{
      id: Uniq.UUID.uuid4(),
      analyst_id: analyst_id,
      quest_id: quest_id,
      status: :running,
      accumulated_seconds: seconds,
      running_since: DateTime.utc_now()
    })
  end

  defp cleanup_analyst(analyst_id) do
    Postgrex.query(Store, "DELETE FROM elixtempo.sessions WHERE analyst_id = $1", [analyst_id])
  end

  test "hours_for sums only stopped sessions, grouped by quest" do
    analyst = "analyst-hours-#{Uniq.UUID.uuid4()}"
    on_exit(fn -> cleanup_analyst(analyst) end)

    seed_stopped(analyst, "quest-x", 3600)
    seed_stopped(analyst, "quest-x", 1800)
    seed_stopped(analyst, "quest-y", 900)
    # running — should be excluded, not "worked" yet for payout purposes
    seed_running(analyst, "quest-z", 100)

    result = Sessions.hours_for(analyst)

    assert result.analyst_id == analyst
    assert result.total_seconds == 6300
    assert result.session_count == 3

    assert Enum.sort(result.by_quest) ==
             Enum.sort([
               %{quest_id: "quest-x", seconds: 5400, session_count: 2},
               %{quest_id: "quest-y", seconds: 900, session_count: 1}
             ])
  end

  test "hours_for respects from/to bounds on when a session stopped" do
    analyst = "analyst-hours-range-#{Uniq.UUID.uuid4()}"
    on_exit(fn -> cleanup_analyst(analyst) end)

    old_id = Uniq.UUID.uuid4()

    Store.upsert(%{
      id: old_id,
      analyst_id: analyst,
      quest_id: "q",
      status: :stopped,
      accumulated_seconds: 1000,
      running_since: nil
    })

    Postgrex.query!(
      Store,
      "UPDATE elixtempo.sessions SET updated_at = now() - interval '10 days' WHERE id = $1",
      [old_id]
    )

    seed_stopped(analyst, "q", 2000)

    assert Sessions.hours_for(analyst).total_seconds == 3000

    recent_only = Sessions.hours_for(analyst, from: DateTime.add(DateTime.utc_now(), -1, :day))
    assert recent_only.total_seconds == 2000
  end

  test "get_session on an unknown id returns not_found" do
    assert Sessions.get_session(Uniq.UUID.uuid4()) == {:error, :not_found}
  end

  test "transitions on an unknown id return not_found" do
    id = Uniq.UUID.uuid4()
    assert Sessions.pause_session(id) == {:error, :not_found}
    assert Sessions.resume_session(id) == {:error, :not_found}
    assert Sessions.stop_session(id) == {:error, :not_found}
  end
end
