defmodule ElixTempoWeb.SessionJSON do
  def show(%{session: session}) do
    %{
      id: session.id,
      analyst_id: session.analyst_id,
      quest_id: session.quest_id,
      status: session.status,
      elapsed_seconds: session.elapsed_seconds
    }
  end
end
