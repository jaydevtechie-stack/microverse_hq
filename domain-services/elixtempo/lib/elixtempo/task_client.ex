defmodule ElixTempo.TaskClient do
  @moduledoc """
  Internal, unauthenticated GET to task-service — same trust posture as
  rustledger's/asset-service's own task_client.rs (Docker network
  isolation is the boundary, not a token; task-service's GET /tasks/:id
  has no role gate). Used to validate a session's quest_id actually
  refers to a real task-service Task, currently assigned to the
  caller, before a session is allowed to start against it.
  """

  @doc "{:ok, task_map} for a real task, {:ok, nil} for a 404, {:error, reason} otherwise."
  def fetch_task(quest_id) do
    # retry: false — Req retries 5xx by default, but a malformed
    # quest_id (task-service 500s on a non-UUID path param) will keep
    # failing the same way every time; no point burning ~7s on retries
    # for a request that's never going to succeed. Same "no automatic
    # retries" posture GoFeeler's own LLM provider call already uses.
    case Req.get(base_url() <> "/api/tasks/" <> quest_id, retry: false) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: 404}} -> {:ok, nil}
      {:ok, %{status: status}} -> {:error, {:unexpected_status, status}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp base_url do
    System.get_env("TASK_SERVICE_URL", "http://microverse-task-service:3000")
  end
end
