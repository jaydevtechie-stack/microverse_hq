// business-services/task-service/models/scout.js
const { pool } = require('../db');

function relativeTime(date) {
  const ms = Date.now() - new Date(date).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Scout's v1 recommendation signal (ROADMAP.md 4.1.1) — "who responds
// fastest" can't be measured yet (no first-action or completed_at
// timestamp anywhere), so this proxies availability instead: an
// analyst with no active task right now ranks first (fully
// available); among analysts who do have one, the longer since their
// oldest active task was assigned, the more available they're assumed
// to be (closer to wrapping up, or just has more slack) — the
// opposite is just as plausible (they could be stuck), which is
// exactly why this is a documented starting signal, not a real
// measurement. Real response-time tracking is Branch 8's job.
//
// Scoped to `service` throughout (tasks_done, active_tasks) — an
// analyst's SpringPix workload isn't counted against their GoFeeler
// availability here, a simplification worth revisiting once an
// analyst's cross-service load actually matters.
async function recommendAnalysts(service) {
  const { rows } = await pool.query(
    `SELECT
       u.id, u.email, u.name, u.avatar_url, u.roles,
       COALESCE(done.count, 0)::int AS tasks_done,
       MIN(at.assigned_at) AS oldest_active_assigned_at,
       COALESCE(
         jsonb_agg(
           jsonb_build_object('id', at.id, 'title', at.title, 'status', at.status, 'due_date', at.due_date)
           ORDER BY at.assigned_at
         ) FILTER (WHERE at.id IS NOT NULL),
         '[]'::jsonb
       ) AS active_tasks
     FROM users u
     LEFT JOIN (
       SELECT assignee, COUNT(*) AS count FROM tasks
       WHERE status IN ('done', 'paid', 'closed') AND service = $2
       GROUP BY assignee
     ) done ON done.assignee = u.email
     LEFT JOIN tasks at ON at.assignee = u.email AND at.status IN ('analyst', 'reviewer') AND at.service = $2
     WHERE u.active = true AND u.roles @> $1::text[]
     GROUP BY u.id, done.count
     ORDER BY oldest_active_assigned_at ASC NULLS FIRST, u.name`,
    [['platform:analyst', `service:${service}`], service]
  );

  return rows.map((candidate) => ({
    ...candidate,
    reason:
      candidate.active_tasks.length === 0
        ? 'No active tasks — fully available'
        : `${candidate.active_tasks.length} active task${candidate.active_tasks.length > 1 ? 's' : ''}, oldest assigned ${relativeTime(candidate.oldest_active_assigned_at)}`,
  }));
}

module.exports = { recommendAnalysts };
