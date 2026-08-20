defmodule ElixTempoWeb.Router do
  use ElixTempoWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug ElixTempoWeb.Auth
  end

  get "/health", ElixTempoWeb.HealthController, :show

  scope "/api", ElixTempoWeb do
    pipe_through :api

    post "/sessions", SessionController, :create
    get "/sessions/:id", SessionController, :show
    post "/sessions/:id/pause", SessionController, :pause
    post "/sessions/:id/resume", SessionController, :resume
    post "/sessions/:id/stop", SessionController, :stop

    get "/analysts/:analyst_id/hours", HoursController, :index
  end
end
