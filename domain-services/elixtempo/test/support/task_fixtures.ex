defmodule ElixTempo.TaskFixtures do
  @moduledoc """
  Seeds real rows directly into task-service's `tasks` table (same
  shared Postgres database, `public` schema — no schema-namespace
  isolation there, so ElixTempo's own Store connection can reach it)
  so Phase 4's quest_id validation has a real task-service Task to
  validate against in tests, rather than the synthetic "quest-1"-style
  strings pre-Phase-4 tests used.
  """

  alias ElixTempo.Sessions.Store

  def email_for(analyst_id), do: "#{analyst_id}@example.com"

  @doc "Inserts a task assigned to analyst_id's email (status 'analyst' by default). Cleans up via on_exit."
  def seed_analyst_task(analyst_id, status \\ "analyst") do
    task_id = Uniq.UUID.uuid4()
    # task-service's tasks.id is a real Postgres `uuid` column (unlike
    # elixtempo's own TEXT-typed sessions.id) — plain Postgrex needs the
    # raw 16-byte binary, not the hyphenated string, for that type.
    raw_id = Uniq.UUID.string_to_binary!(task_id)

    Postgrex.query!(
      Store,
      "INSERT INTO tasks (id, service, title, status, assignee) VALUES ($1, 'gofeeler', 'phase-4 test task', $2, $3)",
      [raw_id, status, email_for(analyst_id)]
    )

    ExUnit.Callbacks.on_exit(fn -> Postgrex.query(Store, "DELETE FROM tasks WHERE id = $1", [raw_id]) end)

    task_id
  end
end
