defmodule ElixTempoWeb.SessionController do
  use ElixTempoWeb, :controller

  alias ElixTempo.Sessions

  def create(conn, %{"analyst_id" => analyst_id, "quest_id" => quest_id}) do
    {:ok, session} = Sessions.start_session(analyst_id, quest_id)

    conn
    |> put_status(:created)
    |> render(:show, session: session)
  end

  def show(conn, %{"id" => id}) do
    respond(conn, Sessions.get_session(id))
  end

  def pause(conn, %{"id" => id}), do: respond(conn, Sessions.pause_session(id))
  def resume(conn, %{"id" => id}), do: respond(conn, Sessions.resume_session(id))
  def stop(conn, %{"id" => id}), do: respond(conn, Sessions.stop_session(id))

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
end
