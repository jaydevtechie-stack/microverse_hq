import json

from kafka import KafkaProducer

from app.kafka_config import KAFKA_BROKERS, REQUESTS_TOPIC, RESULTS_TOPIC


class KafkaResultPublisher:
    """Thin wrapper around kafka-python-ng's KafkaProducer for pyreel's own
    two topics — matches search-service's existing Python Kafka client
    rather than introducing a second one. Takes an injectable client
    (`producer=`) so tests can swap in a fake without needing a real
    broker."""

    def __init__(self, producer=None, brokers: str = KAFKA_BROKERS):
        self._producer = producer or KafkaProducer(
            bootstrap_servers=brokers.split(","),
            value_serializer=lambda value: json.dumps(value).encode("utf-8"),
        )

    def publish_analyze_request(self, request_id: str, video_path: str) -> None:
        self._producer.send(
            REQUESTS_TOPIC,
            key=request_id.encode("utf-8"),
            value={"request_id": request_id, "video_path": video_path},
        )
        self._producer.flush()

    def publish_result(self, request_id: str, result: dict) -> None:
        self._producer.send(
            RESULTS_TOPIC,
            key=request_id.encode("utf-8"),
            value={"request_id": request_id, **result},
        )
        self._producer.flush()
