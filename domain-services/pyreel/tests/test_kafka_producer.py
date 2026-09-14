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
