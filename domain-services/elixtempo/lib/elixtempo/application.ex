defmodule ElixTempo.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    :ok = ElixTempo.KafkaProducer.start_client()

    children = [
      ElixTempo.Sessions.Store,
      ElixTempoWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:elixtempo, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ElixTempo.PubSub},
      {Registry, keys: :unique, name: ElixTempo.Sessions.Registry},
      {DynamicSupervisor, name: ElixTempo.Sessions.Supervisor, strategy: :one_for_one},
      # Start to serve requests, typically the last entry
      ElixTempoWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ElixTempo.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ElixTempoWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
