defmodule ElixTempo.Sessions.StoreTest do
  use ExUnit.Case, async: false

  alias ElixTempo.Sessions.Store

  defp view(overrides) do
    Map.merge(
      %{
        id: Uniq.UUID.uuid4(),
        analyst_id: "analyst-store",
        quest_id: "quest-store",
        status: :running,
        accumulated_seconds: 0,
        running_since: DateTime.utc_now() |> DateTime.truncate(:second)
      },
      overrides
    )
  end

  test "upsert writes a session row that a direct query can read back" do
    running_since = DateTime.utc_now() |> DateTime.truncate(:second)
    v = view(%{running_since: running_since})

    assert :ok = Store.upsert(v)

    assert %Postgrex.Result{rows: [[status, analyst_id, quest_id, accumulated, since]]} =
             Postgrex.query!(
               Store,
               "SELECT status, analyst_id, quest_id, accumulated_seconds, running_since FROM elixtempo.sessions WHERE id = $1",
               [v.id]
             )

    assert status == "running"
    assert analyst_id == v.analyst_id
    assert quest_id == v.quest_id
    assert accumulated == 0
    assert DateTime.compare(since, running_since) == :eq
  end

  test "upsert on an existing id overwrites rather than duplicates" do
    v = view(%{})
    assert :ok = Store.upsert(v)

    stopped = %{v | status: :stopped, accumulated_seconds: 42, running_since: nil}
    assert :ok = Store.upsert(stopped)

    assert %Postgrex.Result{rows: rows} =
             Postgrex.query!(
               Store,
               "SELECT status, accumulated_seconds, running_since FROM elixtempo.sessions WHERE id = $1",
               [v.id]
             )

    assert rows == [["stopped", 42, nil]]
  end
end
