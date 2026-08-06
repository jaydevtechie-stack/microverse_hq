-- Dummy accounts/pm_accounts/projects for local dev — Branch 4.0.2.
-- Matches the platform_projects_hub_and_admin.html mockup's two
-- example accounts/projects, substituting matthew@microverse.local
-- (our one real PM test account — see 02-seed-gofeeler-tasks.sql) for
-- the mockup's fictional "Priya".
--
-- Only runs automatically on a fresh postgres_data volume. To re-seed
-- an existing stack, run it by hand:
--   docker exec -i microverse-postgis psql -U <POSTGRES_USER> -d <POSTGRES_DB> \
--     < infrastructure/postgis/init/04-seed-accounts-projects.sql
--
-- Depends on matthew/mark already existing in `users` (JIT-synced on
-- first login). pm_accounts.pm_id is NOT NULL, so that insert is
-- skipped entirely if matthew hasn't logged in yet (re-run this file
-- by hand once he has). projects.responsible_user_id is nullable, so
-- those inserts always happen — responsible_user_id just comes back
-- NULL if the user hasn't synced yet, filled in on a re-run.

INSERT INTO accounts (type, name) VALUES
  ('company', 'Acme Forestry'),
  ('company', 'Boreal Co');

INSERT INTO pm_accounts (pm_id, account_id)
SELECT (SELECT id FROM users WHERE email = 'matthew@microverse.local'), accounts.id
FROM accounts
WHERE accounts.name IN ('Acme Forestry', 'Boreal Co')
  AND EXISTS (SELECT 1 FROM users WHERE email = 'matthew@microverse.local');

INSERT INTO projects (account_id, name, responsible_user_id, payment_terms)
SELECT accounts.id, 'Q3 Sentiment Monitoring',
       (SELECT id FROM users WHERE email = 'matthew@microverse.local'), 'net_30'
FROM accounts
WHERE accounts.name = 'Acme Forestry';

INSERT INTO projects (account_id, name, responsible_user_id, payment_terms)
SELECT accounts.id, 'Support Sentiment Pilot',
       (SELECT id FROM users WHERE email = 'mark@microverse.local'), 'upfront'
FROM accounts
WHERE accounts.name = 'Boreal Co';

-- Link existing seeded tasks to their project — nullable, so tasks not
-- yet organized under a project (the onboarding sweep, the legacy
-- backlog) are left unlinked on purpose.
UPDATE tasks SET project_id = (SELECT id FROM projects WHERE name = 'Q3 Sentiment Monitoring')
WHERE title IN ('Analyze Q3 customer support chat exports', 'Sentiment report for Acme Forestry support thread');

UPDATE tasks SET project_id = (SELECT id FROM projects WHERE name = 'Support Sentiment Pilot')
WHERE title IN ('Sentiment pass on app store reviews (Aug batch)', 'Re-check flagged negative comments from social import');
