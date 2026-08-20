// platform-services/blog-service/events/kafka-producer.js
//
// Thin wrapper around kafkajs for publishing blog post events to the
// blog-service.posts topic — search-service's blog indexing consumer is
// the only subscriber, mirroring task-service's own
// events/kafka-producer.js (same connect-once/fire-and-forget shape).

const { Kafka } = require('kafkajs');
const { stripAllTags } = require('../lib/sanitize');

const TOPIC = 'blog-service.posts';

const kafka = new Kafka({
  clientId: 'blog-service',
  brokers: (process.env.KAFKA_BROKERS || 'microverse-kafka:9092').split(','),
});
const producer = kafka.producer();

let connected = false;

async function connect() {
  if (connected) return;
  await producer.connect();
  connected = true;
}

// Full current post state, not a delta — the consumer just upserts
// whatever it receives (matches search-service's _id = post_id upsert
// design), so create/update/publish/unpublish can all reuse the same
// publish() shape. `context` folds excerpt + stripped body text into one
// query-target field, deliberately named the same as tasks-<service>'s
// own `context` field — that's what lets search-service's existing
// build_search_query (multi_match on title/context) work unchanged
// across both task and blog-article indices.
function postToEvent(eventName, post) {
  return {
    event: eventName,
    post_id: post.id,
    title: post.title,
    slug: post.slug,
    context: [post.excerpt, stripAllTags(post.body_html || '')].filter(Boolean).join(' '),
    tags: post.tags || [],
    author_name: post.author_name,
    published_at: post.published_at,
    // Routing info, not a doc field — search-service's consumer deletes
    // rather than upserts when this is false, same "rides along on every
    // event so a later transition can't resurrect an excluded doc"
    // reasoning as task-service's no_index flag.
    published: !!post.published_at,
  };
}

// Best-effort, fire-and-forget — same posture as every other producer in
// this stack: a search-index write failing shouldn't fail the API
// response that already committed the real Postgres change.
async function publishPostEvent(eventName, post) {
  try {
    await connect();
    const value = JSON.stringify(postToEvent(eventName, post));
    await producer.send({
      topic: TOPIC,
      messages: [{ key: post.id, value }],
    });
  } catch (err) {
    console.error(`Error publishing ${eventName} for post ${post.id}:`, err.message);
  }
}

module.exports = { publishPostEvent, TOPIC };
