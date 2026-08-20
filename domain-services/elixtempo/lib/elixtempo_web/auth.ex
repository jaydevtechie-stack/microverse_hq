defmodule ElixTempoWeb.Auth do
  @moduledoc """
  Unverified claim extraction — no signature check against Keycloak's
  JWKS, same interim trust posture as task-service's
  middleware/auth.js and rustledger's auth.rs. Stashes decoded claims
  on conn.assigns.claims so controllers can bind a caller's own
  analyst_id to what they're allowed to act on.
  """

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    claims =
      conn
      |> get_req_header("authorization")
      |> claims_from_header()

    assign(conn, :claims, claims)
  end

  defp claims_from_header(["Bearer " <> token | _]) do
    with [_header, payload | _] <- String.split(token, "."),
         {:ok, json} <- Base.url_decode64(payload, padding: false),
         {:ok, claims} <- Jason.decode(json) do
      claims
    else
      _ -> nil
    end
  end

  defp claims_from_header(_), do: nil

  @doc "The caller's own subject claim (Keycloak user id), or nil if unauthenticated/unparseable."
  def caller_id(conn), do: (conn.assigns[:claims] || %{})["sub"]

  @doc """
  Checks the caller's token subject against `analyst_id` — the
  ownership rule every analyst-scoped endpoint uses (session actions,
  the hours query). :ok, {:error, :unauthorized} (no/invalid token),
  or {:error, :forbidden} (authenticated as someone else).
  """
  def authorize_analyst(conn, analyst_id) do
    case caller_id(conn) do
      nil -> {:error, :unauthorized}
      ^analyst_id -> :ok
      _other -> {:error, :forbidden}
    end
  end
end
