defmodule ElixTempoWeb.SessionControllerTest do
  use ElixTempoWeb.ConnCase, async: false

  defp bearer(claims) do
    payload = claims |> Jason.encode!() |> Base.url_encode64(padding: false)
    "Bearer unsigned-header.#{payload}.unsigned-signature"
  end

  defp authed(conn, sub), do: put_req_header(conn, "authorization", bearer(%{"sub" => sub}))

  test "create requires a bearer token", %{conn: conn} do
    conn = post(conn, ~p"/api/sessions", %{"analyst_id" => "analyst-1", "quest_id" => "quest-1"})
    assert json_response(conn, 401)["error"] =~ "bearer token"
  end

  test "create rejects a caller acting as a different analyst", %{conn: conn} do
    conn =
      conn
      |> authed("someone-else")
      |> post(~p"/api/sessions", %{"analyst_id" => "analyst-1", "quest_id" => "quest-1"})

    assert json_response(conn, 403)["error"] =~ "analyst_id"
  end

  test "create/show/pause/resume/stop round-trip for the owning analyst", %{conn: conn} do
    create_conn =
      conn
      |> authed("analyst-1")
      |> post(~p"/api/sessions", %{"analyst_id" => "analyst-1", "quest_id" => "quest-1"})

    assert %{"id" => id, "status" => "running"} = json_response(create_conn, 201)

    show_conn = conn |> authed("analyst-1") |> get(~p"/api/sessions/#{id}")
    assert json_response(show_conn, 200)["status"] == "running"

    pause_conn = conn |> authed("analyst-1") |> post(~p"/api/sessions/#{id}/pause")
    assert json_response(pause_conn, 200)["status"] == "paused"

    resume_conn = conn |> authed("analyst-1") |> post(~p"/api/sessions/#{id}/resume")
    assert json_response(resume_conn, 200)["status"] == "running"

    stop_conn = conn |> authed("analyst-1") |> post(~p"/api/sessions/#{id}/stop")
    assert json_response(stop_conn, 200)["status"] == "stopped"
  end

  test "a different analyst can't pause someone else's session", %{conn: conn} do
    create_conn =
      conn
      |> authed("owner")
      |> post(~p"/api/sessions", %{"analyst_id" => "owner", "quest_id" => "quest-2"})

    %{"id" => id} = json_response(create_conn, 201)

    pause_conn = conn |> authed("intruder") |> post(~p"/api/sessions/#{id}/pause")
    assert json_response(pause_conn, 403)["error"] =~ "analyst_id"
  end

  test "show on an unknown session id is 404 even when authenticated", %{conn: conn} do
    conn = conn |> authed("analyst-1") |> get(~p"/api/sessions/#{Uniq.UUID.uuid4()}")
    assert json_response(conn, 404)
  end
end
