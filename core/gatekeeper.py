"""
Stage I: YOLOv8 Nano Gatekeeper.
Detects person presence and crops the ROI for downstream processing.
"""

import os
from pathlib import Path

import numpy as np

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

# Default model path relative to project root
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_MODEL_PATH = _PROJECT_ROOT / "models" / "yolov8n.pt"


class Gatekeeper:
    """YOLOv8 Nano-based person detection and ROI cropping."""

    def __init__(self, model_path=None, confidence_threshold=0.25):
        # Resolve model path - check models/ directory first
        if model_path is None:
            model_path = str(_DEFAULT_MODEL_PATH) if _DEFAULT_MODEL_PATH.exists() else "yolov8n.pt"
        elif not os.path.exists(model_path):
            # Try models/ directory
            alt_path = _PROJECT_ROOT / "models" / os.path.basename(model_path)
            if alt_path.exists():
                model_path = str(alt_path)
        
        self.model = YOLO(model_path) if YOLO is not None else None
        self.confidence_threshold = confidence_threshold
        self.person_class_id = 0

    def detect_person(self, frame):
        """
        Detect the most confident person in the frame.

        Returns:
            tuple: (person_detected: bool, bbox: np.array or None)
        """
        if self.model is None:
            # Fallback mode: treat the full frame as a single ROI.
            h, w = frame.shape[:2]
            return True, np.array([0, 0, w, h], dtype=int)

        results = self.model(frame, verbose=False)
        best_bbox = None
        best_conf = self.confidence_threshold

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                confidence = float(box.conf)
                if int(box.cls) != self.person_class_id or confidence < best_conf:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                best_bbox = np.array([x1, y1, x2, y2], dtype=int)
                best_conf = confidence

        if best_bbox is None:
            return False, None

        return True, best_bbox

    def crop_roi(self, frame, bbox, padding=20):
        if bbox is None:
            return None

        h, w = frame.shape[:2]
        x1, y1, x2, y2 = bbox

        x1 = max(0, int(x1) - padding)
        y1 = max(0, int(y1) - padding)
        x2 = min(w, int(x2) + padding)
        y2 = min(h, int(y2) + padding)

        if x2 <= x1 or y2 <= y1:
            return None

        cropped = frame[y1:y2, x1:x2]
        if cropped.size == 0:
            return None

        return cropped

    def process(self, frame):
        person_detected, bbox = self.detect_person(frame)

        if not person_detected:
            return False, None, None

        cropped_frame = self.crop_roi(frame, bbox)
        if cropped_frame is None:
            return False, None, None

        return True, cropped_frame, bbox
