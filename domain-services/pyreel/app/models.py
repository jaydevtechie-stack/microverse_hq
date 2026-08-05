from pydantic import BaseModel

class VideoAnalysisRequest(BaseModel):
    video_url: str  # URL to video or filename

class VideoAnalysisResponse(BaseModel):
    filename: str
    duration_seconds: float
    frames_analyzed: int
    detected_objects: list
