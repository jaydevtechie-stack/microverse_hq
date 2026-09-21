import json

from kafka import KafkaProducer

from app.kafka_config import KAFKA_BROKERS, REQUESTS_TOPIC, RESULTS_TOPIC


class KafkaResultPublisher:
    """Thin wrapper around kafka-python-ng's KafkaProducer for pyreel's own
    two topics — matches search-service's existing Python Kafka client
    rather than introducing a second one. Takes an injectable client
    (`producer=`) so tests can swap in a fake without needing a real
    broker.

    Construction is deliberately lazy: KafkaProducer's own __init__ blocks
    on check_version(), a real connection attempt — building one eagerly
    at FastAPI startup (main.py's startup_event) raced Kafka's own boot
    and took the whole app down with NoBrokersAvailable on a cold
    docker-compose start, not just a failed request. Deferring the actual
    connection to first send() means the object always constructs
    instantly; only a real publish call can hit a not-yet-ready broker.
    """

    def __init__(self, producer=None, brokers: str = KAFKA_BROKERS):
        self._producer = producer
        self._brokers = brokers

    def _get_producer(self) -> KafkaProducer:
        if self._producer is None:
            self._producer = KafkaProducer(
                bootstrap_servers=self._brokers.split(","),
                value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            )
        return self._producer

    def publish_analyze_request(self, request_id: str, video_path: str) -> None:
        producer = self._get_producer()
        producer.send(
            REQUESTS_TOPIC,
            key=request_id.encode("utf-8"),
            value={"request_id": request_id, "video_path": video_path},
        )
        producer.flush()

    def publish_result(self, request_id: str, result: dict) -> None:
        producer = self._get_producer()
        producer.send(
            RESULTS_TOPIC,
            key=request_id.encode("utf-8"),
            value={"request_id": request_id, **result},
        )
        producer.flush()
