from pydantic import BaseModel


class VideoAnalysisResult(BaseModel):
    duration_seconds: float
    resolution: str
    codec: str
    has_audio: bool


class AsyncAnalysisAccepted(BaseModel):
    request_id: str
    status: str = "queued"
