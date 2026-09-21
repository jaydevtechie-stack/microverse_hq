import json
from unittest.mock import patch

from app.kafka_consumer import handle_message


class FakePublisher:
    def __init__(self):
        self.published = []

    def publish_result(self, request_id, result):
        self.published.append((request_id, result))


def test_handle_message_publishes_real_analysis_result():
    publisher = FakePublisher()
    raw = json.dumps({"request_id": "req-1", "video_path": "/tmp/fake.mp4"}).encode("utf-8")
    fake_result = {"duration_seconds": 5.0, "resolution": "640x480", "codec": "h264", "has_audio": True}

    with patch("app.kafka_consumer.analyze_video", return_value=fake_result):
        handle_message(raw, publisher)

    assert publisher.published == [("req-1", fake_result)]


def test_handle_message_skips_malformed_json():
    publisher = FakePublisher()
    handle_message(b"not json", publisher)
    assert publisher.published == []


def test_handle_message_skips_missing_fields():
    publisher = FakePublisher()
    raw = json.dumps({"request_id": "req-1"}).encode("utf-8")  # no video_path
    handle_message(raw, publisher)
    assert publisher.published == []


def test_handle_message_does_not_publish_on_analysis_failure():
    from app.video_analyzer import VideoAnalysisError

    publisher = FakePublisher()
    raw = json.dumps({"request_id": "req-1", "video_path": "/tmp/bad.mp4"}).encode("utf-8")

    with patch("app.kafka_consumer.analyze_video", side_effect=VideoAnalysisError("boom")):
        handle_message(raw, publisher)

    assert publisher.published == []
