defmodule ElixTempoWeb.HoursControllerTest do
  use ElixTempoWeb.ConnCase, async: false

  alias ElixTempo.Sessions.Store

  defp bearer(claims) do
    payload = claims |> Jason.encode!() |> Base.url_encode64(padding: false)
    "Bearer unsigned-header.#{payload}.unsigned-signature"
  end

  defp authed(conn, sub), do: put_req_header(conn, "authorization", bearer(%{"sub" => sub}))

  test "requires a bearer token", %{conn: conn} do
    conn = get(conn, ~p"/api/analysts/analyst-1/hours")
    assert json_response(conn, 401)["error"] =~ "bearer token"
  end

  test "rejects a caller asking for someone else's hours", %{conn: conn} do
    conn = conn |> authed("someone-else") |> get(~p"/api/analysts/analyst-1/hours")
    assert json_response(conn, 403)["error"] =~ "analyst_id"
  end

  test "returns aggregate hours for the owning analyst", %{conn: conn} do
    analyst = "analyst-hours-ctrl-#{Uniq.UUID.uuid4()}"
    on_exit(fn -> Postgrex.query(Store, "DELETE FROM elixtempo.sessions WHERE analyst_id = $1", [analyst]) end)

    Store.upsert(%{
      id: Uniq.UUID.uuid4(),
      analyst_id: analyst,
      quest_id: "q1",
      status: :stopped,
      accumulated_seconds: 3600,
      running_since: nil
    })

    conn = conn |> authed(analyst) |> get(~p"/api/analysts/#{analyst}/hours")

    body = json_response(conn, 200)
    assert body["analyst_id"] == analyst
    assert body["total_seconds"] == 3600
    assert body["total_hours"] == 1.0
    assert body["session_count"] == 1
    assert body["by_quest"] == [%{"quest_id" => "q1", "seconds" => 3600, "hours" => 1.0, "session_count" => 1}]
  end

  test "rejects malformed from/to", %{conn: conn} do
    conn = conn |> authed("analyst-1") |> get(~p"/api/analysts/analyst-1/hours?from=not-a-date")
    assert json_response(conn, 400)
  end
end
