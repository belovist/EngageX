"""
Stage II: Head Pose Estimation using MediaPipe Face Mesh
Calculates yaw, pitch, roll angles using Perspective-n-Point (PnP) algorithm.

REQUIREMENT: MediaPipe Face Mesh with 468 landmarks MUST be used.
NO OpenCV Haar Cascades allowed.
"""

import cv2
import numpy as np

try:
    import mediapipe as mp
except Exception:
    mp = None

if mp is not None:
    try:
        mp_face_mesh = mp.solutions.face_mesh
    except Exception:
        mp_face_mesh = None
else:
    mp_face_mesh = None


class HeadPoseEstimator:
    """
    MediaPipe Face Mesh-based head pose estimation.
    Uses 468 facial landmarks and cv2.solvePnP for pose calculation.
    """
    
    # Standard 3D face model points (in mm, normalized)
    # These correspond to key facial landmarks for PnP
    FACE_3D_MODEL = np.array([
        [0.0, 0.0, 0.0],           # Nose tip (landmark 1)
        [0.0, -330.0, -65.0],      # Chin (landmark 175)
        [-225.0, 170.0, -135.0],   # Left eye left corner (landmark 33)
        [225.0, 170.0, -135.0],    # Right eye right corner (landmark 263)
        [-150.0, -150.0, -125.0],  # Left mouth corner (landmark 61)
        [150.0, -150.0, -125.0]    # Right mouth corner (landmark 291)
    ], dtype=np.float64)
    
    # MediaPipe Face Mesh landmark indices (468 landmarks total)
    LANDMARK_INDICES = [
        1,   # Nose tip
        175, # Chin
        33,  # Left eye left corner
        263, # Right eye right corner
        61,  # Left mouth corner
        291  # Right mouth corner
    ]

    # Inter-eye landmarks for dynamic 3D model scaling (depth / scale alignment)
    LM_LEFT_EYE = 33   # left eye outer corner (canonical for inter-eye distance)
    LM_RIGHT_EYE = 263  # right eye outer corner
    
    def __init__(self):
        """
        Initialize MediaPipe Face Mesh.
        REQUIRES MediaPipe solutions module - no fallback.
        """
        self.mp_face_mesh = mp_face_mesh
        self.face_mesh = None

        if self.mp_face_mesh is not None:
            self.face_mesh = self.mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,  # Use refined landmarks (468 points)
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
    
    def get_landmarks(self, frame):
        """
        Extract 2D facial landmarks from frame using MediaPipe Face Mesh.
        
        Args:
            frame: Input BGR frame (cropped face ROI from Stage I)
            
        Returns:
            landmarks: Array of 6 key landmark coordinates [Nx2] or None
        """
        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)
        
        if not results.multi_face_landmarks:
            return None
        
        # Get the first (and only) face
        face_landmarks = results.multi_face_landmarks[0]
        h, w = frame.shape[:2]
        
        # Extract the 6 key landmarks for PnP
        landmark_points = []
        for idx in self.LANDMARK_INDICES:
            landmark = face_landmarks.landmark[idx]
            # Convert normalized coordinates to pixel coordinates
            x = float(landmark.x * w)
            y = float(landmark.y * h)
            landmark_points.append([x, y])
        
        return np.array(landmark_points, dtype=np.float32)
    
    def calculate_pose_score(self, yaw, pitch, roll):
        """
        Calculate normalized Pose Score (0.0 to 1.0) based on head orientation.
        Score decreases as user turns away from forward-facing position.
        
        Args:
            yaw: Yaw angle in degrees
            pitch: Pitch angle in degrees
            roll: Roll angle in degrees
            
        Returns:
            pose_score: Float between 0.0 and 1.0
        """
        # Absolute angles
        abs_yaw = abs(yaw)
        abs_pitch = abs(pitch)
        abs_roll = abs(roll)
        
        # Thresholds (degrees) - beyond these, score approaches 0
        yaw_threshold = 30.0
        pitch_threshold = 30.0
        roll_threshold = 15.0
        
        # Calculate individual component scores
        yaw_score = max(0.0, 1.0 - (abs_yaw / yaw_threshold))
        pitch_score = max(0.0, 1.0 - (abs_pitch / pitch_threshold))
        roll_score = max(0.0, 1.0 - (abs_roll / roll_threshold))
        
        # Weighted combination (yaw and pitch more important)
        pose_score = 0.4 * yaw_score + 0.4 * pitch_score + 0.2 * roll_score
        
        return np.clip(pose_score, 0.0, 1.0)
    
    def estimate_pose(self, frame):
        """
        Estimate head pose angles (yaw, pitch, roll) using cv2.solvePnP.

        Dynamic 3D scaling (depth alignment):
        1) Read MediaPipe landmarks 33 and 263 (left / right eye).
        2) 2D Euclidean distance between those points.
        3) scale_factor = distance_2d / 450.0
        4) face_3d_scaled = face_3d_model * scale_factor
        5) Pass face_3d_scaled into cv2.solvePnP with the 6 PnP points.

        Args:
            frame: Input BGR frame (cropped face ROI)

        Returns:
            tuple: (success: bool, result: dict or None)
                   result contains 'yaw', 'pitch', 'roll' (degrees) and 'pose_score' (0-1)
        """
        if self.face_mesh is None:
            return False, None

        # Single Face Mesh pass: avoids duplicate inference and keeps scale + PnP consistent
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            return False, None

        face_landmarks = results.multi_face_landmarks[0]
        h, w = frame.shape[:2]

        # --- Task 1: Dynamic 3D model scaling from inter-eye distance (LM 33 & 263) ---
        lm_left = face_landmarks.landmark[self.LM_LEFT_EYE]
        lm_right = face_landmarks.landmark[self.LM_RIGHT_EYE]
        left_eye_px = np.array([lm_left.x * w, lm_left.y * h], dtype=np.float32)
        right_eye_px = np.array([lm_right.x * w, lm_right.y * h], dtype=np.float32)
        eye_distance_2d = float(np.linalg.norm(left_eye_px - right_eye_px))

        if eye_distance_2d < 10.0:  # Sanity check (too small / invalid)
            return False, None

        scale_factor = eye_distance_2d / 450.0
        face_3d_scaled = self.FACE_3D_MODEL * scale_factor

        # --- 6-point 2D correspondences for PnP (same order as FACE_3D_MODEL rows) ---
        landmark_points = []
        for idx in self.LANDMARK_INDICES:
            lm = face_landmarks.landmark[idx]
            landmark_points.append([float(lm.x * w), float(lm.y * h)])
        landmarks_2d = np.array(landmark_points, dtype=np.float32)

        # Camera intrinsic parameters (approximate)
        focal_length = float(w)
        center = (w / 2.0, h / 2.0)
        camera_matrix = np.array([
            [focal_length, 0.0, center[0]],
            [0.0, focal_length, center[1]],
            [0.0, 0.0, 1.0]
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        
        # Solve PnP to get rotation and translation vectors
        success, rotation_vector, translation_vector = cv2.solvePnP(
            face_3d_scaled,
            landmarks_2d,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )
        
        if not success:
            return False, None
        
        # Convert rotation vector to rotation matrix
        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        
        # Extract Euler angles (yaw, pitch, roll) from rotation matrix
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
        
        # Convert to degrees
        yaw_deg = np.degrees(yaw)
        pitch_deg = np.degrees(pitch)
        roll_deg = np.degrees(roll)
        
        # Calculate normalized Pose Score
        pose_score = self.calculate_pose_score(yaw_deg, pitch_deg, roll_deg)
        
        return True, {
            'yaw': yaw_deg,
            'pitch': pitch_deg,
            'roll': roll_deg,
            'pose_score': pose_score
        }
    
    def process(self, frame):
        """
        Process frame and return head pose angles and score.
        
        Args:
            frame: Input BGR frame (cropped face ROI)
            
        Returns:
            tuple: (success: bool, result: dict or None)
        """
        return self.estimate_pose(frame)
