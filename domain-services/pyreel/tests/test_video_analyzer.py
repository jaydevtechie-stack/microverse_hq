import json
from unittest.mock import patch

import pytest

from app.video_analyzer import VideoAnalysisError, analyze_video


def _ffprobe_output(duration="12.34", width=1920, height=1080, video_codec="h264", has_audio=True):
    streams = [
        {"codec_type": "video", "codec_name": video_codec, "width": width, "height": height}
    ]
    if has_audio:
        streams.append({"codec_type": "audio", "codec_name": "aac"})
    return json.dumps({"format": {"duration": duration}, "streams": streams})


def _mock_run(stdout="", returncode=0, stderr=""):
    def _run(*args, **kwargs):
        result = type("Result", (), {})()
        result.stdout = stdout
        result.stderr = stderr
        result.returncode = returncode
        return result

    return _run


def test_analyze_video_returns_real_metadata():
    with patch("subprocess.run", side_effect=_mock_run(stdout=_ffprobe_output())):
        result = analyze_video("/tmp/fake.mp4")

    assert result["duration_seconds"] == 12.34
    assert result["resolution"] == "1920x1080"
    assert result["codec"] == "h264"
    assert result["has_audio"] is True


def test_analyze_video_detects_no_audio_track():
    with patch("subprocess.run", side_effect=_mock_run(stdout=_ffprobe_output(has_audio=False))):
        result = analyze_video("/tmp/fake.mp4")

    assert result["has_audio"] is False


def test_analyze_video_raises_when_ffprobe_fails():
    with patch("subprocess.run", side_effect=_mock_run(returncode=1, stderr="No such file")):
        with pytest.raises(VideoAnalysisError, match="No such file"):
            analyze_video("/tmp/missing.mp4")


def test_analyze_video_raises_when_no_video_stream():
    audio_only = json.dumps({"format": {"duration": "5.0"}, "streams": [{"codec_type": "audio"}]})
    with patch("subprocess.run", side_effect=_mock_run(stdout=audio_only)):
        with pytest.raises(VideoAnalysisError, match="no video stream"):
            analyze_video("/tmp/audio-only.mp3")
