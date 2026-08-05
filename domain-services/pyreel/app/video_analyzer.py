import random

def analyze_video(filename: str):
    """
    Placeholder for video analysis.
    In production, this could run object detection, scene detection, etc.
    """
    duration = round(random.uniform(10, 300), 2)  # seconds
    frames = int(duration * 24)  # assume 24 fps
    objects = ["car", "person", "cat"]  # dummy detected objects
    return {
        "filename": filename,
        "duration_seconds": duration,
        "frames_analyzed": frames,
        "detected_objects": objects
    }
