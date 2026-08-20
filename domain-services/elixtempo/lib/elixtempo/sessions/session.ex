defmodule ElixTempo.Sessions.Session do
  @moduledoc """
  One GenServer per active work session. BEAM processes cost only a few KB
  each, so running hundreds of these concurrently — one per analyst per
  quest currently being worked — is cheap; that's the whole reason this
  service is Elixir rather than something that'd need a thread/connection
  per session.

  State lives only here — in memory. Durability comes from Kafka: every
  transition publishes an event before this process's state changes.
  """
  # restart: :temporary — a stopped session is done, not a crash to
  # recover from. The default :permanent would make DynamicSupervisor
  # respawn it with fresh state (status: :running, elapsed_seconds: 0)
  # under the same id the instant it exits normally after `stop`.
  use GenServer, restart: :temporary

  defstruct [:id, :analyst_id, :quest_id, :status, :accumulated_seconds, :running_since]

  def start_link({id, analyst_id, quest_id}) do
    GenServer.start_link(__MODULE__, {id, analyst_id, quest_id}, name: via(id))
  end

  # Rehydrate form — spawned by ElixTempo.Sessions.rehydrate_all/0 on
  # boot, one per still-open row in Postgres. Seeded directly from
  # persisted raw state rather than starting fresh, so a restart is
  # transparent to the analyst's clock: a running session keeps
  # accruing from its real running_since, it doesn't reset to zero or
  # freeze for the downtime.
  def start_link({id, analyst_id, quest_id, status, accumulated_seconds, running_since}) do
    GenServer.start_link(
      __MODULE__,
      {id, analyst_id, quest_id, status, accumulated_seconds, running_since},
      name: via(id)
    )
  end

  def pause(id), do: GenServer.call(via(id), :pause)
  def resume(id), do: GenServer.call(via(id), :resume)
  def stop(id), do: GenServer.call(via(id), :stop)
  def view(id), do: GenServer.call(via(id), :view)

  defp via(id), do: {:via, Registry, {ElixTempo.Sessions.Registry, id}}

  @impl true
  def init({id, analyst_id, quest_id}) do
    state = %__MODULE__{
      id: id,
      analyst_id: analyst_id,
      quest_id: quest_id,
      status: :running,
      accumulated_seconds: 0,
      running_since: DateTime.utc_now()
    }

    {:ok, state}
  end

  @impl true
  def init({id, analyst_id, quest_id, status, accumulated_seconds, running_since}) do
    state = %__MODULE__{
      id: id,
      analyst_id: analyst_id,
      quest_id: quest_id,
      status: status,
      accumulated_seconds: accumulated_seconds,
      running_since: running_since
    }

    {:ok, state}
  end

  @impl true
  def handle_call(:pause, _from, %{status: :running} = state) do
    state = %{state | status: :paused, accumulated_seconds: elapsed(state), running_since: nil}
    {:reply, {:ok, to_view(state)}, state}
  end

  def handle_call(:pause, _from, state), do: {:reply, {:error, :not_running}, state}

  def handle_call(:resume, _from, %{status: :paused} = state) do
    state = %{state | status: :running, running_since: DateTime.utc_now()}
    {:reply, {:ok, to_view(state)}, state}
  end

  def handle_call(:resume, _from, state), do: {:reply, {:error, :not_paused}, state}

  def handle_call(:stop, _from, state) do
    final = %{
      state
      | status: :stopped,
        accumulated_seconds: elapsed(state),
        running_since: nil
    }

    # replies with the final view, then terminates — nothing left to do
    # once a session is stopped, it doesn't hang around
    {:stop, :normal, {:ok, to_view(final)}, final}
  end

  def handle_call(:view, _from, state) do
    {:reply, {:ok, to_view(state)}, state}
  end

  defp elapsed(%{status: :running, accumulated_seconds: acc, running_since: since}) do
    acc + DateTime.diff(DateTime.utc_now(), since, :second)
  end

  defp elapsed(%{accumulated_seconds: acc}), do: acc

  # accumulated_seconds/running_since ride along on the view alongside
  # the computed elapsed_seconds — SessionJSON doesn't surface them (no
  # public API change), but Sessions.Store needs the raw fields as-is to
  # persist and later rehydrate a session without recomputing anything.
  defp to_view(state) do
    %{
      id: state.id,
      analyst_id: state.analyst_id,
      quest_id: state.quest_id,
      status: state.status,
      elapsed_seconds: elapsed(state),
      accumulated_seconds: state.accumulated_seconds,
      running_since: state.running_since
    }
  end
end
