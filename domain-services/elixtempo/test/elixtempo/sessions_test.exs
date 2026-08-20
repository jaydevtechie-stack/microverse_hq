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
