-- Dummy Gofeeler tasks for local dev — lets the gofeeler landing page
-- (applications/taskfusion/src/pages/GofeelerPage.js) show something
-- real without order-service/task-creation existing yet.
--
-- Only runs automatically on a fresh postgres_data volume. To re-seed
-- an existing stack (e.g. after manually clearing the tasks table),
-- run it by hand:
--   docker exec -i microverse-postgis psql -U <POSTGRES_USER> -d <POSTGRES_DB> \
--     < infrastructure/postgis/init/02-seed-gofeeler-tasks.sql
INSERT INTO tasks (service, title, status, assignee, owner, due_date) VALUES
  ('gofeeler', 'Analyze Q3 customer support chat exports', 'unassigned', NULL, NULL, now() + interval '5 days'),
  ('gofeeler', 'Sentiment pass on app store reviews (Aug batch)', 'analyst', 'jane.doe', 'jane.doe', now() + interval '2 days'),
  ('gofeeler', 'Re-check flagged negative comments from social import', 'reviewer', 'sam.reviewer', 'sam.reviewer', now() + interval '1 day'),
  ('gofeeler', 'Sentiment report for Acme Forestry support thread', 'done', NULL, 'pm.morgan', now() - interval '1 day'),
  ('gofeeler', 'Email sentiment sweep for onboarding cohort', 'paid', NULL, 'customer.acme', now() - interval '6 days'),
  ('gofeeler', 'Legacy ticket batch (2024 backlog)', 'closed', NULL, NULL, now() - interval '30 days');
