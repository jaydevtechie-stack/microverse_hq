defmodule ElixTempoWeb.HealthController do
  use ElixTempoWeb, :controller

  def show(conn, _params) do
    text(conn, "ok")
  end
end
