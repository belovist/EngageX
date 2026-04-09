from pathlib import Path
import sys
from typing import Optional, Tuple, Dict, Any



from core.gatekeeper import Gatekeeper


class FaceDetector:
    def __init__(self, model_path: str = "yolov8n.pt", confidence_threshold: float = 0.5):
        self.gatekeeper = Gatekeeper(model_path=model_path, confidence_threshold=confidence_threshold)

    def detect(self, frame) -> Dict[str, Any]:
        person_detected, cropped_frame, bbox = self.gatekeeper.process(frame)
        return {
            "person_detected": bool(person_detected),
            "face_roi": cropped_frame,
            "bbox": bbox,
        }
