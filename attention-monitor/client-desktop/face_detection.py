from pathlib import Path
import sys
from typing import Optional, Tuple, Dict, Any


_THIS_FILE = Path(__file__).resolve()
_PROJECT_ROOT = _THIS_FILE.parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from gatekeeper import Gatekeeper


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
