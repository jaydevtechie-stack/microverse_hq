defmodule ElixTempo.TaskClientTest do
  use ExUnit.Case, async: false

  alias ElixTempo.TaskClient
  alias ElixTempo.TaskFixtures

  import TaskFixtures, only: [seed_analyst_task: 1, email_for: 1]

  test "fetch_task returns the task for a real id" do
    quest_id = seed_analyst_task("client-test-analyst")

    assert {:ok, task} = TaskClient.fetch_task(quest_id)
    assert task["status"] == "analyst"
    assert task["assignee"] == email_for("client-test-analyst")
  end

  test "fetch_task returns {:ok, nil} for an unknown id" do
    assert TaskClient.fetch_task(Uniq.UUID.uuid4()) == {:ok, nil}
  end

  test "fetch_task surfaces a malformed id as an error rather than crashing" do
    assert {:error, _reason} = TaskClient.fetch_task("not-a-uuid")
  end
end
