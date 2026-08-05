import Config

# force_ssl is intentionally left off — unlike taskfusion, this service
# isn't behind an nginx TLS-terminating proxy, it's called directly
# container-to-container over plain HTTP. Turn it back on (with
# rewrite_on: [:x_forwarded_proto]) if that changes.

# Do not print debug messages in production
config :logger, level: :info

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
