import os
import tempfile
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile

from app.kafka_consumer import start_consumer_thread
from app.kafka_producer import KafkaResultPublisher
from app.models import AsyncAnalysisAccepted, VideoAnalysisResult
from app.video_analyzer import VideoAnalysisError, analyze_video

app = FastAPI(title="PyReel Video Analyzer", version="1.0")

# Interim ingestion path only (Phase 1.1) — not the production upload path.
# See docs/roadmap/1.1/domain-services.md's PyReel "Upload path" open
# question: a real customer upload goes through asset-service/MinIO once
# Phase 2 wires this into the task pool. This just needs a real file on
# disk for the Kafka consumer thread (same container) to run ffprobe
# against, proving the event wiring end to end ahead of that.
UPLOAD_DIR = os.environ.get("PYREEL_UPLOAD_DIR", "/tmp/pyreel-uploads")

_publisher = None


def get_publisher() -> KafkaResultPublisher:
    global _publisher
    if _publisher is None:
        _publisher = KafkaResultPublisher()
    return _publisher


@app.on_event("startup")
def startup_event():
    start_consumer_thread(get_publisher())


@app.get("/")
async def root():
    return {"message": "PyReel service is running"}


def _suffix(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1]


@app.post("/analyze", response_model=VideoAnalysisResult)
async def analyze(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=_suffix(file.filename)) as tmp:
        tmp.write(await file.read())
        tmp.flush()
        try:
            result = analyze_video(tmp.name)
        except VideoAnalysisError as err:
            raise HTTPException(status_code=400, detail=str(err))
    return result


@app.post("/analyze/async", response_model=AsyncAnalysisAccepted)
async def analyze_async(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    request_id = str(uuid.uuid4())
    video_path = os.path.join(UPLOAD_DIR, f"{request_id}{_suffix(file.filename)}")

    with open(video_path, "wb") as f:
        f.write(await file.read())

    get_publisher().publish_analyze_request(request_id, video_path)
    return AsyncAnalysisAccepted(request_id=request_id)
