import json
import logging
import threading
import time

from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

from app.kafka_config import KAFKA_BROKERS, REQUESTS_TOPIC
from app.kafka_producer import KafkaResultPublisher
from app.video_analyzer import VideoAnalysisError, analyze_video

logger = logging.getLogger(__name__)

CONSUMER_GROUP = "pyreel-analyzer"


def handle_message(raw_value: bytes, publisher: KafkaResultPublisher) -> None:
    try:
        event = json.loads(raw_value)
    except (json.JSONDecodeError, TypeError):
        logger.error("failed to parse analyze-request event, skipping: %r", raw_value)
        return

    request_id = event.get("request_id")
    video_path = event.get("video_path")
    if not request_id or not video_path:
        logger.warning("skipping event missing request_id/video_path: %s", event)
        return

    try:
        result = analyze_video(video_path)
    except VideoAnalysisError as err:
        logger.error("analysis failed for %s: %s", request_id, err)
        return

    publisher.publish_result(request_id, result)
    logger.info("analyzed %s: %s", request_id, result)


def _build_consumer(brokers: str) -> KafkaConsumer:
    return KafkaConsumer(
        REQUESTS_TOPIC,
        bootstrap_servers=brokers.split(","),
        group_id=CONSUMER_GROUP,
        auto_offset_reset="earliest",
        value_deserializer=lambda raw: raw,
    )


def run_consumer_with_retry(
    publisher: KafkaResultPublisher,
    brokers: str = KAFKA_BROKERS,
    stop_event: threading.Event = None,
) -> None:
    """Blocking loop, meant to run on its own thread — same retry-on-
    NoBrokersAvailable / clean-shutdown shape as search-service's
    kafka_consumer.py, since Kafka may not be reachable yet at pyreel's
    own boot (container startup ordering)."""
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
                handle_message(message.value, publisher)
        except Exception:
            logger.exception("kafka consumer error, retrying in 5s")
            time.sleep(5)
        finally:
            consumer.close()


def start_consumer_thread(
    publisher: KafkaResultPublisher = None, brokers: str = KAFKA_BROKERS
) -> tuple:
    publisher = publisher or KafkaResultPublisher(brokers=brokers)
    stop_event = threading.Event()
    thread = threading.Thread(
        target=run_consumer_with_retry,
        args=(publisher, brokers, stop_event),
        daemon=True,
        name="kafka-analyze-requests",
    )
    thread.start()
    return thread, stop_event
