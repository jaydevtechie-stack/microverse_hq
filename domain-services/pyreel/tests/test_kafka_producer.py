from unittest.mock import patch

from app.kafka_producer import KafkaResultPublisher


class FakeKafkaProducer:
    def __init__(self):
        self.sent = []
        self.flushed = 0

    def send(self, topic, key=None, value=None):
        self.sent.append((topic, key, value))

    def flush(self):
        self.flushed += 1


def test_publish_analyze_request_sends_to_requests_topic():
    fake = FakeKafkaProducer()
    publisher = KafkaResultPublisher(producer=fake)

    publisher.publish_analyze_request("req-1", "/tmp/fake.mp4")

    assert len(fake.sent) == 1
    topic, key, value = fake.sent[0]
    assert topic == "pyreel.analyze-requests"
    assert key == b"req-1"
    assert value == {"request_id": "req-1", "video_path": "/tmp/fake.mp4"}
    assert fake.flushed == 1


def test_construction_does_not_build_a_kafka_producer():
    # Regression test: KafkaProducer's own __init__ blocks on
    # check_version(), a real connection attempt — building one eagerly
    # in KafkaResultPublisher.__init__ (the original implementation) took
    # the whole app down with NoBrokersAvailable on a cold docker-compose
    # start, before pyreel and kafka had finished their own startup race.
    # Mocking KafkaProducer itself (rather than pointing at a real
    # unreachable host) keeps this fast — a genuine failed-connection
    # test takes ~25s waiting on kafka-python-ng's own retry/backoff.
    with patch("app.kafka_producer.KafkaProducer") as mock_producer_cls:
        publisher = KafkaResultPublisher(brokers="unreachable-host.invalid:9092")
        mock_producer_cls.assert_not_called()

        publisher.publish_result("req-1", {"duration_seconds": 1.0})
        mock_producer_cls.assert_called_once()


def test_publish_result_sends_to_videos_topic():
    fake = FakeKafkaProducer()
    publisher = KafkaResultPublisher(producer=fake)
    result = {"duration_seconds": 5.0, "resolution": "640x480", "codec": "h264", "has_audio": True}

    publisher.publish_result("req-1", result)

    assert len(fake.sent) == 1
    topic, key, value = fake.sent[0]
    assert topic == "pyreel.videos"
    assert key == b"req-1"
    assert value == {"request_id": "req-1", **result}
