defmodule ElixTempo.Sessions.Supervisor do
  @moduledoc """
  Thin wrapper around a plain DynamicSupervisor: once it's up, spawns a
  Session GenServer per still-open row in Postgres (Store.list_open/0,
  via ElixTempo.Sessions.rehydrate_all/0) before start_link returns.
  Ordering this ahead of the Endpoint in ElixTempo.Application's
  children list guarantees every session that survives a restart is
  back in memory before the first request could possibly arrive for
  it — same synchronous-ordering trick Store uses for its own schema
  creation.
  """

  def child_spec(opts) do
    %{id: __MODULE__, start: {__MODULE__, :start_link, [opts]}}
  end

  def start_link(_opts) do
    case DynamicSupervisor.start_link(name: __MODULE__, strategy: :one_for_one) do
      {:ok, pid} ->
        ElixTempo.Sessions.rehydrate_all()
        {:ok, pid}

      error ->
        error
    end
  end
end
