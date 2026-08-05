-- Dummy Gofeeler tasks for local dev — lets the gofeeler landing page
-- (applications/taskfusion/src/pages/GofeelerPage.js) show something
-- real without order-service/task-creation existing yet.
--
-- Assignee/owner use the real Keycloak usernames of the four local
-- test accounts (see ARCHITECTURE.md's assignee/owner table for which
-- field is populated in which state):
--   matthew@microverse.local — platform:project-manager
--   mark@microverse.local    — platform:analyst
--   john@microverse.local    — platform:reviewer
--   luke@microverse.local    — platform:customer
--
-- Only runs automatically on a fresh postgres_data volume. To re-seed
-- an existing stack (e.g. after manually clearing the tasks table),
-- run it by hand:
--   docker exec -i microverse-postgis psql -U <POSTGRES_USER> -d <POSTGRES_DB> \
--     < infrastructure/postgis/init/02-seed-gofeeler-tasks.sql
INSERT INTO tasks (service, title, status, assignee, owner, due_date) VALUES
  ('gofeeler', 'Analyze Q3 customer support chat exports', 'unassigned', NULL, NULL, now() + interval '5 days'),
  ('gofeeler', 'Sentiment pass on app store reviews (Aug batch)', 'analyst', 'mark@microverse.local', 'mark@microverse.local', now() + interval '2 days'),
  ('gofeeler', 'Re-check flagged negative comments from social import', 'reviewer', 'john@microverse.local', 'john@microverse.local', now() + interval '1 day'),
  ('gofeeler', 'Sentiment report for Acme Forestry support thread', 'done', NULL, 'matthew@microverse.local', now() - interval '1 day'),
  ('gofeeler', 'Email sentiment sweep for onboarding cohort', 'paid', NULL, 'luke@microverse.local', now() - interval '6 days'),
  ('gofeeler', 'Legacy ticket batch (2024 backlog)', 'closed', NULL, NULL, now() - interval '30 days');
