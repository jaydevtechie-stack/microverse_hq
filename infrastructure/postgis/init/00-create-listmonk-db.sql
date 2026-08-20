-- Listmonk owns its own full schema (subscribers, lists, campaigns, and
-- its own migrations/settings tables) and runs its own migration tool
-- against whatever database it's pointed at — it gets a dedicated
-- database on this shared instance rather than a spot inside
-- ${POSTGRES_DB} alongside every app service's tables. Runs before the
-- numbered app-schema scripts (00- prefix) though ordering doesn't
-- actually matter between them — different databases.
CREATE DATABASE listmonk;
