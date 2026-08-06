-- Dummy task_comments for local dev — Branch 3.3 works with seeded
-- data only (no POST /comments endpoint yet, no real submission UI;
-- that's Branch 4's end-to-end work). Covers all the shapes the UI
-- needs to render: a lone top-level comment with no reply, a top-level
-- comment with its one allowed reply, and (visibility='customer') a
-- note the customer can see plus their own reply to it — see
-- SCHEMA.md's task_comments for why visibility/internal-vs-customer is
-- one table rather than two.
--
-- Only runs automatically on a fresh postgres_data volume. To re-seed
-- an existing stack, run it by hand:
--   docker exec -i microverse-postgis psql -U <POSTGRES_USER> -d <POSTGRES_DB> \
--     < infrastructure/postgis/init/03-seed-gofeeler-comments.sql
--
-- Each block generates the top-level comment's id/comment_id once (they
-- must match — see SCHEMA.md's task_comments) via a materialized CTE,
-- then reuses it for the reply's parent_comment_id.

-- 'Sentiment pass on app store reviews (Aug batch)' — lone comment, no reply
WITH task_ref AS (
  SELECT id FROM tasks WHERE title = 'Sentiment pass on app store reviews (Aug batch)'
),
top AS (
  SELECT gen_random_uuid() AS top_id
)
INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, version, content, created_at)
SELECT top_id, top_id, NULL, task_ref.id, 'mark@microverse.local', 1,
       'Mixed results so far — bimodal split between 1-star and 5-star reviews, very few 3s.',
       now() - interval '10 hours'
FROM top, task_ref;

-- 'Re-check flagged negative comments from social import' — comment + reply
-- (reply gets its own id/comment_id pair — its own thread — with
-- parent_comment_id pointing at the top-level comment's comment_id)
WITH task_ref AS (
  SELECT id FROM tasks WHERE title = 'Re-check flagged negative comments from social import'
),
top AS (
  SELECT gen_random_uuid() AS top_id
),
reply AS (
  SELECT gen_random_uuid() AS reply_id
)
INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, version, content, created_at)
SELECT top_id, top_id, NULL, task_ref.id, 'mark@microverse.local', 1,
       'Customer seems to be a repeat contact — worth flagging to support lead.',
       now() - interval '20 hours'
FROM top, task_ref
UNION ALL
SELECT reply_id, reply_id, top_id, task_ref.id, 'john@microverse.local', 1,
       'Good catch — I''ll flag this before approving.',
       now() - interval '18 hours'
FROM top, reply, task_ref;

-- 'Sentiment report for Acme Forestry support thread' — comment + reply
WITH task_ref AS (
  SELECT id FROM tasks WHERE title = 'Sentiment report for Acme Forestry support thread'
),
top AS (
  SELECT gen_random_uuid() AS top_id
),
reply AS (
  SELECT gen_random_uuid() AS reply_id
)
INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, version, content, created_at)
SELECT top_id, top_id, NULL, task_ref.id, 'john@microverse.local', 1,
       'Approved — sentiment breakdown looks solid, no red flags.',
       now() - interval '2 days'
FROM top, task_ref
UNION ALL
SELECT reply_id, reply_id, top_id, task_ref.id, 'matthew@microverse.local', 1,
       'Thanks — billing the client for this one today.',
       now() - interval '1 day'
FROM top, reply, task_ref;

-- 'Email sentiment sweep for onboarding cohort' — customer-facing note
-- + the customer's own reply (owner is luke@microverse.local, the
-- seeded customer test account — see 02-seed-gofeeler-tasks.sql)
WITH task_ref AS (
  SELECT id FROM tasks WHERE title = 'Email sentiment sweep for onboarding cohort'
),
top AS (
  SELECT gen_random_uuid() AS top_id
),
reply AS (
  SELECT gen_random_uuid() AS reply_id
)
INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, visibility, version, content, created_at)
SELECT top_id, top_id, NULL, task_ref.id, 'matthew@microverse.local', 'customer', 1,
       'Results are in and the invoice has been paid — let us know if you''d like a walkthrough of the findings.',
       now() - interval '5 hours'
FROM top, task_ref
UNION ALL
SELECT reply_id, reply_id, top_id, task_ref.id, 'luke@microverse.local', 'customer', 1,
       'Thanks, this looks great — no walkthrough needed.',
       now() - interval '3 hours'
FROM top, reply, task_ref;

-- Second customer-facing thread on the same task — an open ask, no
-- reply yet (demonstrates the "staff asks the customer for more info"
-- case, distinct from the answered thread above).
WITH task_ref AS (
  SELECT id FROM tasks WHERE title = 'Email sentiment sweep for onboarding cohort'
),
top AS (
  SELECT gen_random_uuid() AS top_id
)
INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, visibility, version, content, created_at)
SELECT top_id, top_id, NULL, task_ref.id, 'mark@microverse.local', 'customer', 1,
       'Quick follow-up for our records — should these be filed under the Q3 or Q4 onboarding cohort?',
       now() - interval '1 hour'
FROM top, task_ref;

-- Second reply on 'Re-check flagged negative comments from social
-- import' — matthew (PM) joins mark (analyst) and john (reviewer) on
-- the same thread, demonstrating multiple replies at one level (the
-- one-level rule caps depth, not the number of replies per thread).
WITH task_ref AS (
  SELECT id FROM tasks WHERE title = 'Re-check flagged negative comments from social import'
),
top AS (
  SELECT comment_id AS top_id FROM task_comments
  WHERE task_id = (SELECT id FROM task_ref) AND parent_comment_id IS NULL
),
reply AS (
  SELECT gen_random_uuid() AS reply_id
)
INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, version, content, created_at)
SELECT reply_id, reply_id, top_id, task_ref.id, 'matthew@microverse.local', 1,
       'Agreed — loop in support before we close this one out.',
       now() - interval '16 hours'
FROM top, reply, task_ref;
