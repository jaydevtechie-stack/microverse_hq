defmodule ElixTempoWeb.HoursController do
  use ElixTempoWeb, :controller

  alias ElixTempo.Sessions
  alias ElixTempoWeb.Auth

  def index(conn, %{"analyst_id" => analyst_id} = params) do
    case Auth.authorize_analyst(conn, analyst_id) do
      :ok -> respond(conn, analyst_id, params)
      {:error, :unauthorized} -> unauthorized(conn)
      {:error, :forbidden} -> forbidden(conn)
    end
  end

  defp respond(conn, analyst_id, params) do
    with {:ok, from} <- parse_bound(params["from"]),
         {:ok, to} <- parse_bound(params["to"]) do
      render(conn, :index, Sessions.hours_for(analyst_id, from: from, to: to))
    else
      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "from/to must be ISO8601 datetimes"})
    end
  end

  defp parse_bound(nil), do: {:ok, nil}
  defp parse_bound(""), do: {:ok, nil}

  defp parse_bound(value) do
    case DateTime.from_iso8601(value) do
      {:ok, dt, _offset} -> {:ok, dt}
      {:error, _} -> :error
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "missing or invalid bearer token"})
  end

  defp forbidden(conn) do
    conn
    |> put_status(:forbidden)
    |> json(%{error: "caller does not match this analyst_id"})
  end
end
