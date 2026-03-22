"""
Stage I: YOLOv8 Nano Gatekeeper.
Detects person presence and crops the ROI for downstream processing.
"""

import numpy as np
from ultralytics import YOLO


class Gatekeeper:
    """YOLOv8 Nano-based person detection and ROI cropping."""

    def __init__(self, model_path="yolov8n.pt", confidence_threshold=0.5):
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold
        self.person_class_id = 0

    def detect_person(self, frame):
        """
        Detect the most confident person in the frame.

        Returns:
            tuple: (person_detected: bool, bbox: np.array or None)
        """
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
