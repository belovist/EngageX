"""Lightweight real-time attention monitoring pipeline.

Stages:
1) YOLOv8 Nano gatekeeper (presence + ROI cropping)
2) MediaPipe Face Mesh + solvePnP for head pose
3) Pluggable gaze estimator interface
4) Weighted attentiveness score + EMA smoothing
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
from ultralytics import YOLO


@dataclass
class HeadPose:
    yaw: float
    pitch: float
    roll: float


class Gatekeeper:
    """YOLO gatekeeper for person presence and ROI cropping."""

    def __init__(self, model_name: str = "yolov8n.pt", conf: float = 0.4):
        self.model = YOLO(model_name)
        self.conf = conf

    def detect_person_roi(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        results = self.model.predict(frame, conf=self.conf, verbose=False)
        if not results:
            return None

        h, w = frame.shape[:2]
        best_box = None
        best_area = 0
        for box in results[0].boxes:
            cls = int(box.cls.item())
            if cls != 0:  # COCO person class
                continue
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            area = (x2 - x1) * (y2 - y1)
            if area > best_area:
                best_area = area
                best_box = (x1, y1, x2, y2)

        return best_box


class HeadPoseEstimator:
    """MediaPipe Face Mesh + solvePnP head pose estimator."""

    def __init__(self):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        # Landmark indices: nose tip, chin, left eye corner, right eye corner, left mouth, right mouth
        self.landmark_ids = [1, 152, 33, 263, 61, 291]
        self.model_points = np.array(
            [
                (0.0, 0.0, 0.0),
                (0.0, -63.6, -12.5),
                (-43.3, 32.7, -26.0),
                (43.3, 32.7, -26.0),
                (-28.9, -28.9, -24.1),
                (28.9, -28.9, -24.1),
            ],
            dtype=np.float64,
        )

    def estimate(self, frame_bgr: np.ndarray) -> Optional[HeadPose]:
        h, w = frame_bgr.shape[:2]
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        result = self.face_mesh.process(rgb)
        if not result.multi_face_landmarks:
            return None

        lm = result.multi_face_landmarks[0].landmark
        image_points = []
        for idx in self.landmark_ids:
            x = lm[idx].x * w
            y = lm[idx].y * h
            image_points.append((x, y))
        image_points = np.array(image_points, dtype=np.float64)

        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]],
            dtype=np.float64,
        )
        dist_coeffs = np.zeros((4, 1))

        ok, rvec, _ = cv2.solvePnP(
            self.model_points,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not ok:
            return None

        rotation_matrix, _ = cv2.Rodrigues(rvec)
        sy = math.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            pitch = math.atan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
            yaw = math.atan2(-rotation_matrix[2, 0], sy)
            roll = math.atan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
        else:
            pitch = math.atan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
            yaw = math.atan2(-rotation_matrix[2, 0], sy)
            roll = 0

        return HeadPose(
            yaw=math.degrees(yaw),
            pitch=math.degrees(pitch),
            roll=math.degrees(roll),
        )


class GazeEstimator:
    """Pluggable gaze model wrapper.

    Replace `estimate` with L2CS-Net inference logic.
    """

    def estimate(self, face_roi_bgr: np.ndarray, head_pose: HeadPose) -> Optional[np.ndarray]:
        _ = face_roi_bgr, head_pose
        return None


class AttentionScorer:
    """Weighted instantaneous score + EMA smoothing."""

    def __init__(self, alpha: float = 0.2, w_head: float = 0.6, w_gaze: float = 0.4):
        self.alpha = alpha
        self.w_head = w_head
        self.w_gaze = w_gaze
        self.ema_score = 0.0

    @staticmethod
    def _head_score(pose: HeadPose) -> float:
        yaw_penalty = min(abs(pose.yaw) / 45.0, 1.0)
        pitch_penalty = min(abs(pose.pitch) / 35.0, 1.0)
        return max(0.0, 1.0 - 0.7 * yaw_penalty - 0.3 * pitch_penalty)

    @staticmethod
    def _gaze_score(gaze_vec: Optional[np.ndarray]) -> float:
        if gaze_vec is None:
            return 0.0
        gx, gy, gz = gaze_vec
        off_axis = min((abs(gx) + abs(gy)) / max(abs(gz), 1e-6), 1.0)
        return max(0.0, 1.0 - off_axis)

    def update(self, pose: HeadPose, gaze_vec: Optional[np.ndarray]) -> float:
        instant = self.w_head * self._head_score(pose) + self.w_gaze * self._gaze_score(gaze_vec)
        self.ema_score = self.alpha * instant + (1 - self.alpha) * self.ema_score
        return self.ema_score


def draw_overlay(frame: np.ndarray, pose: HeadPose, score: float):
    cv2.putText(frame, f"Yaw: {pose.yaw: .1f}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    cv2.putText(frame, f"Pitch: {pose.pitch: .1f}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    cv2.putText(frame, f"Roll: {pose.roll: .1f}", (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    cv2.putText(frame, f"Attention EMA: {score:.2f}", (10, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)


def run(camera_index: int):
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera index {camera_index}")

    gatekeeper = Gatekeeper()
    head_pose_estimator = HeadPoseEstimator()
    gaze_estimator = GazeEstimator()
    scorer = AttentionScorer(alpha=0.2)

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        roi = gatekeeper.detect_person_roi(frame)
        if roi is None:
            cv2.putText(frame, "No person detected", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.imshow("Attention Monitor", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
            continue

        x1, y1, x2, y2 = roi
        face_roi = frame[y1:y2, x1:x2]

        pose = head_pose_estimator.estimate(face_roi)
        if pose is not None:
            gaze_vec = gaze_estimator.estimate(face_roi, pose)
            score = scorer.update(pose, gaze_vec)
            draw_overlay(frame, pose, score)

        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
        cv2.imshow("Attention Monitor", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CPU-friendly real-time attention monitor")
    parser.add_argument("--camera", type=int, default=0, help="Camera index for OpenCV VideoCapture")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args.camera)
