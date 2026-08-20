import json
import logging
import os
import threading
import time

from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

logger = logging.getLogger(__name__)

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092")
POSTS_TOPIC = "blog-service.posts"
CONSUMER_GROUP = "search-service-blog-indexer"


def post_event_to_doc(event: dict) -> dict:
    """Maps a blog-service post event onto the blog-articles mapping.

    `context` (not `excerpt`/`body`) is deliberate — it's the same field
    name tasks-<service> docs use for their query target, so main.py's
    build_search_query (multi_match on title/context) works unchanged
    across both task and blog-article indices with no per-type branching.
    """
    return {
        "title": event.get("title"),
        "slug": event.get("slug"),
        "context": event.get("context"),
        "tags": event.get("tags") or [],
        "author_name": event.get("author_name"),
        "published_at": event.get("published_at"),
    }


def index_post_event(es, event: dict, blog_index: str) -> None:
    """Upsert, not append — except when published is false.

    Every mutation (post.created, post.updated, post.published,
    post.unpublished) republishes the post's full current state, and
    _id = post_id means this is always "replace with latest." A post
    that isn't currently published (draft, or just unpublished) is
    default-excluded rather than upserted — deleting is a no-op
    (ignore_status=404) if it was never indexed or already removed.
    """
    post_id = event.get("post_id")
    if not post_id:
        logger.warning("skipping blog post event missing post_id: %s", event)
        return
    if not event.get("published"):
        es.options(ignore_status=404).delete(index=blog_index, id=post_id)
        return
    es.index(index=blog_index, id=post_id, document=post_event_to_doc(event))


def _build_consumer(brokers: str) -> KafkaConsumer:
    return KafkaConsumer(
        POSTS_TOPIC,
        bootstrap_servers=brokers.split(","),
        group_id=CONSUMER_GROUP,
        auto_offset_reset="earliest",
        value_deserializer=lambda raw: raw,
    )


def run_consumer_with_retry(es, blog_index: str, brokers: str = KAFKA_BROKERS, stop_event: threading.Event = None) -> None:
    """Blocking loop meant to run on its own thread — same retry-not-crash
    posture as kafka_consumer.py's tasks indexer, a separate consumer
    group on a separate topic, not a second subscription bolted onto that
    one (mirrors search-service's tasks indexer being independent of
    notification-service's/audit-service's own consumer groups on
    task-service.tasks).
    """
    stop_event = stop_event or threading.Event()
    while not stop_event.is_set():
        try:
            consumer = _build_consumer(brokers)
        except NoBrokersAvailable:
            logger.warning("kafka not reachable yet, retrying in 5s")
            time.sleep(5)
            continue

        try:
            for message in consumer:
                if stop_event.is_set():
                    break
                try:
                    event = json.loads(message.value)
                except (json.JSONDecodeError, TypeError):
                    logger.error("failed to parse blog post event, skipping: %r", message.value)
                    continue
                index_post_event(es, event, blog_index)
        except Exception:
            logger.exception("kafka consumer error, retrying in 5s")
            time.sleep(5)
        finally:
            consumer.close()


def start_kafka_consumer_thread(es, blog_index: str, brokers: str = KAFKA_BROKERS) -> tuple:
    stop_event = threading.Event()
    thread = threading.Thread(
        target=run_consumer_with_retry,
        args=(es, blog_index, brokers, stop_event),
        daemon=True,
        name="kafka-blog-indexer",
    )
    thread.start()
    return thread, stop_event
