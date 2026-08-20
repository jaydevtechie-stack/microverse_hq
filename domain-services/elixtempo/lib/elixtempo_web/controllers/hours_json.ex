defmodule ElixTempoWeb.HoursJSON do
  def index(%{analyst_id: analyst_id, total_seconds: total_seconds, session_count: session_count, by_quest: by_quest}) do
    %{
      analyst_id: analyst_id,
      total_seconds: total_seconds,
      total_hours: hours(total_seconds),
      session_count: session_count,
      by_quest: Enum.map(by_quest, &quest_entry/1)
    }
  end

  defp quest_entry(%{quest_id: quest_id, seconds: seconds, session_count: session_count}) do
    %{quest_id: quest_id, seconds: seconds, hours: hours(seconds), session_count: session_count}
  end

  defp hours(seconds), do: Float.round(seconds / 3600, 2)
end
