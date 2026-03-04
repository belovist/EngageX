"""
Stage I: YOLOv8 Nano Gatekeeper
Detects person presence and crops ROI for downstream processing.
"""

import cv2
import numpy as np
from ultralytics import YOLO


class Gatekeeper:
    """YOLOv8 Nano-based person detection and ROI cropping."""
    
    def __init__(self, model_path='yolov8n.pt', confidence_threshold=0.5):
        """
        Initialize the YOLOv8 Nano model.
        
        Args:
            model_path: Path to YOLOv8 Nano weights (will download if not present)
            confidence_threshold: Minimum confidence for person detection
        """
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold
        self.person_class_id = 0  # COCO class ID for 'person'
    
    def detect_person(self, frame):
        """
        Detect person in the frame.
        
        Args:
            frame: Input BGR frame
            
        Returns:
            tuple: (person_detected: bool, bbox: np.array or None)
                   bbox format: [x1, y1, x2, y2] or None if no person
        """
        results = self.model(frame, verbose=False)
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Check if detected class is 'person' and confidence is above threshold
                    if int(box.cls) == self.person_class_id and box.conf >= self.confidence_threshold:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        return True, np.array([x1, y1, x2, y2], dtype=int)
        
        return False, None
    
    def crop_roi(self, frame, bbox, padding=20):
        """
        Crop the region of interest (person) from the frame.
        
        Args:
            frame: Input BGR frame
            bbox: Bounding box [x1, y1, x2, y2]
            padding: Additional pixels to add around the bbox
            
        Returns:
            cropped_frame: Cropped image or None if bbox is invalid
        """
        if bbox is None:
            return None
        
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = bbox
        
        # Add padding and ensure within frame bounds
        x1 = max(0, int(x1) - padding)
        y1 = max(0, int(y1) - padding)
        x2 = min(w, int(x2) + padding)
        y2 = min(h, int(y2) + padding)
        
        cropped = frame[y1:y2, x1:x2]
        return cropped
    
    def process(self, frame):
        """
        Complete gatekeeper processing: detect person and crop ROI.
        
        Args:
            frame: Input BGR frame
            
        Returns:
            tuple: (person_detected: bool, cropped_frame: np.array or None, bbox: np.array or None)
        """
        person_detected, bbox = self.detect_person(frame)
        
        if person_detected:
            cropped_frame = self.crop_roi(frame, bbox)
            return person_detected, cropped_frame, bbox
        else:
            return False, None, None
