defmodule ElixTempoWeb.SessionController do
  use ElixTempoWeb, :controller

  alias ElixTempo.Sessions
  alias ElixTempoWeb.Auth

  def create(conn, %{"analyst_id" => analyst_id, "quest_id" => quest_id}) do
    with_authorized_analyst(conn, analyst_id, fn ->
      {:ok, session} = Sessions.start_session(analyst_id, quest_id)

      conn
      |> put_status(:created)
      |> render(:show, session: session)
    end)
  end

  def show(conn, %{"id" => id}), do: act_as_owner(conn, id, fn -> Sessions.get_session(id) end)
  def pause(conn, %{"id" => id}), do: act_as_owner(conn, id, fn -> Sessions.pause_session(id) end)
  def resume(conn, %{"id" => id}), do: act_as_owner(conn, id, fn -> Sessions.resume_session(id) end)
  def stop(conn, %{"id" => id}), do: act_as_owner(conn, id, fn -> Sessions.stop_session(id) end)

  # Looks the session up first so ownership can be checked against its
  # actual analyst_id, then (only once authorized) runs the caller's
  # action — which for pause/resume/stop re-reads the session by id
  # rather than reusing the view above, since those are transitions,
  # not queries.
  defp act_as_owner(conn, id, action) do
    case Sessions.get_session(id) do
      {:ok, view} ->
        with_authorized_analyst(conn, view.analyst_id, fn -> respond(conn, action.()) end)

      error ->
        respond(conn, error)
    end
  end

  defp with_authorized_analyst(conn, analyst_id, action) do
    case Auth.authorize_analyst(conn, analyst_id) do
      :ok -> action.()
      {:error, :unauthorized} -> unauthorized(conn)
      {:error, :forbidden} -> forbidden(conn)
    end
  end

  defp respond(conn, {:ok, session}) do
    render(conn, :show, session: session)
  end

  defp respond(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> json(%{error: "session not found"})
  end

  defp respond(conn, {:error, reason}) do
    conn
    |> put_status(:conflict)
    |> json(%{error: to_string(reason)})
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "missing or invalid bearer token"})
  end

  defp forbidden(conn) do
    conn
    |> put_status(:forbidden)
    |> json(%{error: "caller does not match this session's analyst_id"})
  end
end
