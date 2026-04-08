"""
Stage II: Head Pose Estimation using MediaPipe face landmarks.
Calculates yaw, pitch, roll angles using Perspective-n-Point (PnP) algorithm.
"""

import time
from pathlib import Path

import cv2
import numpy as np

try:
    import mediapipe as mp
except Exception:
    mp = None

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_TASK_MODEL_CANDIDATES = (
    _PROJECT_ROOT / "models" / "face_landmarker.task",
    _PROJECT_ROOT / "models" / "face_landmarker_v2.task",
)

if mp is not None:
    try:
        mp_face_mesh = mp.solutions.face_mesh
    except Exception:
        mp_face_mesh = None

    try:
        mp_tasks_vision = mp.tasks.vision
        mp_base_options = mp.tasks.BaseOptions
    except Exception:
        mp_tasks_vision = None
        mp_base_options = None
else:
    mp_face_mesh = None
    mp_tasks_vision = None
    mp_base_options = None


class HeadPoseEstimator:
    """
    MediaPipe-based head pose estimation.
    Uses 468 facial landmarks and cv2.solvePnP for pose calculation.
    """

    FACE_3D_MODEL = np.array(
        [
            [0.0, 0.0, 0.0],
            [0.0, -330.0, -65.0],
            [-225.0, 170.0, -135.0],
            [225.0, 170.0, -135.0],
            [-150.0, -150.0, -125.0],
            [150.0, -150.0, -125.0],
        ],
        dtype=np.float64,
    )

    LANDMARK_INDICES = [1, 175, 33, 263, 61, 291]
    LM_LEFT_EYE = 33
    LM_RIGHT_EYE = 263

    def __init__(self):
        self.mp_face_mesh = mp_face_mesh
        self.face_mesh = None
        self.face_landmarker = None
        self.backend = None
        self._last_timestamp_ms = 0

        if self.mp_face_mesh is not None:
            self.face_mesh = self.mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self.backend = "solutions"
            return

        task_model_path = next((path for path in _TASK_MODEL_CANDIDATES if path.exists()), None)
        if mp_tasks_vision is not None and mp_base_options is not None and task_model_path is not None:
            try:
                options = mp_tasks_vision.FaceLandmarkerOptions(
                    base_options=mp_base_options(model_asset_path=str(task_model_path)),
                    running_mode=mp_tasks_vision.RunningMode.VIDEO,
                    num_faces=1,
                    min_face_detection_confidence=0.5,
                    min_face_presence_confidence=0.5,
                    min_tracking_confidence=0.5,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                )
                self.face_landmarker = mp_tasks_vision.FaceLandmarker.create_from_options(options)
                landmarker_cls = self.face_landmarker.__class__
                if not getattr(landmarker_cls, "_engagex_safe_del_patched", False):
                    original_del = getattr(landmarker_cls, "__del__", None)

                    def _safe_del(instance):
                        try:
                            if original_del is not None:
                                original_del(instance)
                        except Exception:
                            pass

                    landmarker_cls.__del__ = _safe_del
                    landmarker_cls._engagex_safe_del_patched = True
                self.backend = "tasks"
            except Exception as exc:
                print(f"Warning: MediaPipe FaceLandmarker failed to initialize: {exc}")
        elif mp_tasks_vision is not None and task_model_path is None:
            print("Warning: MediaPipe FaceLandmarker model is missing. Expected models/face_landmarker.task")

    def _next_timestamp_ms(self):
        now_ms = int(time.monotonic() * 1000)
        if now_ms <= self._last_timestamp_ms:
            now_ms = self._last_timestamp_ms + 1
        self._last_timestamp_ms = now_ms
        return now_ms

    def _extract_face_landmarks(self, frame):
        if self.backend == "solutions" and self.face_mesh is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_frame)
            if not results.multi_face_landmarks:
                return None
            return results.multi_face_landmarks[0].landmark

        if self.backend == "tasks" and self.face_landmarker is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            results = self.face_landmarker.detect_for_video(mp_image, self._next_timestamp_ms())
            if not results.face_landmarks:
                return None
            return results.face_landmarks[0]

        return None

    def get_landmarks(self, frame):
        face_landmarks = self._extract_face_landmarks(frame)
        if face_landmarks is None:
            return None

        h, w = frame.shape[:2]
        landmark_points = []
        for idx in self.LANDMARK_INDICES:
            landmark = face_landmarks[idx]
            x = float(landmark.x * w)
            y = float(landmark.y * h)
            landmark_points.append([x, y])

        return np.array(landmark_points, dtype=np.float32)

    def calculate_pose_score(self, yaw, pitch, roll):
        abs_yaw = abs(yaw)
        abs_pitch = abs(pitch)
        abs_roll = abs(roll)

        yaw_threshold = 30.0
        pitch_threshold = 30.0
        roll_threshold = 15.0

        yaw_score = max(0.0, 1.0 - (abs_yaw / yaw_threshold))
        pitch_score = max(0.0, 1.0 - (abs_pitch / pitch_threshold))
        roll_score = max(0.0, 1.0 - (abs_roll / roll_threshold))

        pose_score = 0.4 * yaw_score + 0.4 * pitch_score + 0.2 * roll_score
        return np.clip(pose_score, 0.0, 1.0)

    def estimate_pose(self, frame):
        if self.backend is None:
            return False, None

        face_landmarks = self._extract_face_landmarks(frame)
        if face_landmarks is None:
            return False, None

        h, w = frame.shape[:2]

        lm_left = face_landmarks[self.LM_LEFT_EYE]
        lm_right = face_landmarks[self.LM_RIGHT_EYE]
        left_eye_px = np.array([lm_left.x * w, lm_left.y * h], dtype=np.float32)
        right_eye_px = np.array([lm_right.x * w, lm_right.y * h], dtype=np.float32)
        eye_distance_2d = float(np.linalg.norm(left_eye_px - right_eye_px))

        if eye_distance_2d < 10.0:
            return False, None

        scale_factor = eye_distance_2d / 450.0
        face_3d_scaled = self.FACE_3D_MODEL * scale_factor

        landmark_points = []
        for idx in self.LANDMARK_INDICES:
            lm = face_landmarks[idx]
            landmark_points.append([float(lm.x * w), float(lm.y * h)])
        landmarks_2d = np.array(landmark_points, dtype=np.float32)

        focal_length = float(w)
        center = (w / 2.0, h / 2.0)
        camera_matrix = np.array(
            [
                [focal_length, 0.0, center[0]],
                [0.0, focal_length, center[1]],
                [0.0, 0.0, 1.0],
            ],
            dtype=np.float64,
        )

        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        success, rotation_vector, translation_vector = cv2.solvePnP(
            face_3d_scaled,
            landmarks_2d,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )

        if not success:
            return False, None

        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            yaw = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
            pitch = np.arctan2(-rotation_matrix[2, 0], sy)
            roll = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
        else:
            yaw = np.arctan2(-rotation_matrix[0, 1], rotation_matrix[1, 1])
            pitch = np.arctan2(-rotation_matrix[2, 0], sy)
            roll = 0.0

        yaw_deg = np.degrees(yaw)
        pitch_deg = np.degrees(pitch)
        roll_deg = np.degrees(roll)
        pose_score = self.calculate_pose_score(yaw_deg, pitch_deg, roll_deg)

        return True, {
            "yaw": yaw_deg,
            "pitch": pitch_deg,
            "roll": roll_deg,
            "pose_score": pose_score,
        }

    def process(self, frame):
        return self.estimate_pose(frame)

    def close(self):
        if self.face_mesh is not None and hasattr(self.face_mesh, "close"):
            try:
                self.face_mesh.close()
            except Exception:
                pass
            self.face_mesh = None

        if self.face_landmarker is not None:
            self.face_landmarker = None

    def __del__(self):
        self.close()
