import json
import logging
import os
import threading
import time

from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

logger = logging.getLogger(__name__)

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092")
TASKS_TOPIC = "task-service.tasks"
CONSUMER_GROUP = "search-service-tasks-indexer"


def task_event_to_doc(event: dict) -> dict:
    """Maps a task-service lifecycle event onto the tasks-<service> mapping (6.1).

    Deliberately whitelists fields rather than passing the event through
    as-is — task_id/service/event on the event are routing info, not doc
    content (task_id becomes the ES _id, service selects the index,
    event is unused after routing here).
    """
    return {
        "title": event.get("title"),
        "context": event.get("context"),
        "status": event.get("status"),
        "tags": event.get("tags") or [],
        "owner": event.get("owner"),
        "assignee_ids": event.get("assignee_ids") or [],
        "customer_id": event.get("customer_id"),
        "account_id": event.get("account_id"),
        "project_id": event.get("project_id"),
        "created_at": event.get("created_at"),
        "assigned_at": event.get("assigned_at"),
    }


def index_task_event(es, event: dict, service_index_name) -> None:
    """Upsert, not append.

    Every lifecycle transition (task.assigned, task.moved-to-review,
    task.reviewer-reassigned, task.approved, task.rejected) republishes
    the task's full current state, and _id = task_id (6.1.3) means this
    is always "replace with latest," never a partial patch — that's what
    makes "index on assign / update on reassign or reviewer-change" a
    single code path instead of one per event type.
    """
    task_id = event.get("task_id")
    service = event.get("service")
    if not task_id or not service:
        logger.warning("skipping task event missing task_id/service: %s", event)
        return
    es.index(index=service_index_name(service), id=task_id, document=task_event_to_doc(event))


def _build_consumer(brokers: str) -> KafkaConsumer:
    return KafkaConsumer(
        TASKS_TOPIC,
        bootstrap_servers=brokers.split(","),
        group_id=CONSUMER_GROUP,
        auto_offset_reset="earliest",
        value_deserializer=lambda raw: raw,
    )


def run_consumer_with_retry(es, service_index_name, brokers: str = KAFKA_BROKERS, stop_event: threading.Event = None) -> None:
    """Blocking loop — meant to run on its own thread (see start_kafka_consumer_thread),
    not the asyncio event loop, matching how the rest of this module already
    calls the sync Elasticsearch client directly. Kafka may not be reachable
    yet at search-service boot (container startup ordering) or the topic may
    not exist yet (task-service hasn't published anything) — both retry
    rather than crash the app, same posture as rustledger's connect-retry
    loop (domain-services/rustledger/src/kafka_consumer.rs).
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
                    logger.error("failed to parse task event, skipping: %r", message.value)
                    continue
                index_task_event(es, event, service_index_name)
        except Exception:
            logger.exception("kafka consumer error, retrying in 5s")
            time.sleep(5)
        finally:
            consumer.close()


def start_kafka_consumer_thread(es, service_index_name, brokers: str = KAFKA_BROKERS) -> tuple:
    """Starts run_consumer_with_retry on a daemon thread. Returns (thread, stop_event)
    so callers can signal a clean shutdown (see main.py's stop_kafka_consumer).
    """
    stop_event = threading.Event()
    thread = threading.Thread(
        target=run_consumer_with_retry,
        args=(es, service_index_name, brokers, stop_event),
        daemon=True,
        name="kafka-tasks-indexer",
    )
    thread.start()
    return thread, stop_event
