import json
import subprocess


class VideoAnalysisError(Exception):
    """Raised when ffprobe can't read the file, or it has no video stream."""


def analyze_video(path: str) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise VideoAnalysisError(f"ffprobe failed for {path}: {result.stderr.strip()}")

    probe = json.loads(result.stdout)
    streams = probe.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video_stream is None:
        raise VideoAnalysisError(f"no video stream found in {path}")

    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    duration_seconds = float(probe.get("format", {}).get("duration", 0.0))

    return {
        "duration_seconds": duration_seconds,
        "resolution": f"{video_stream.get('width')}x{video_stream.get('height')}",
        "codec": video_stream.get("codec_name", "unknown"),
        "has_audio": has_audio,
    }
