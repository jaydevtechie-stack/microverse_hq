import threading
from fastapi import FastAPI, UploadFile, File
from app.video_analyzer import analyze_video
from app.models import VideoAnalysisResponse
from app.rabbitmq_consumer import start_consumer

app = FastAPI(title="PyReel Video Analyzer", version="1.0")

@app.on_event("startup")
def startup_event():
    # Run RabbitMQ consumer in a separate thread
    threading.Thread(target=start_consumer, daemon=True).start()

@app.get("/")
async def root():
    return {"message": "PyReel service is running"}

@app.post("/analyze", response_model=VideoAnalysisResponse)
async def analyze(file: UploadFile = File(...)):
    filename = file.filename
    result = analyze_video(filename)
    return result
