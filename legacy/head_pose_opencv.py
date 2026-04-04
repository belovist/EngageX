"""
Stage II: Head Pose Estimation using OpenCV DNN
Alternative implementation that doesn't require MediaPipe solutions module.
Calculates yaw, pitch, roll angles using facial landmarks.
"""

import cv2
import numpy as np


class HeadPoseEstimator:
    """OpenCV DNN-based head pose estimation (MediaPipe alternative)."""
    
    # 3D face model points (normalized coordinates)
    # These correspond to key facial landmarks
    FACE_3D_MODEL = np.array([
        [0.0, 0.0, 0.0],           # Nose tip
        [0.0, -330.0, -65.0],       # Chin
        [-225.0, 170.0, -135.0],   # Left eye left corner
        [225.0, 170.0, -135.0],     # Right eye right corner
        [-150.0, -150.0, -125.0],  # Left mouth corner
        [150.0, -150.0, -125.0]     # Right mouth corner
    ], dtype=np.float64)
    
    def __init__(self):
        """Initialize face detector using OpenCV DNN."""
        # Try to load OpenCV's DNN face detector
        try:
            # Download these files if not present:
            # https://github.com/opencv/opencv_extra/blob/master/testdata/dnn/opencv_face_detector_uint8.pb
            # https://github.com/opencv/opencv_extra/blob/master/testdata/dnn/opencv_face_detector.pbtxt
            prototxt_path = "opencv_face_detector.pbtxt"
            model_path = "opencv_face_detector_uint8.pb"
            
            # Fallback to Haar Cascade if DNN files not found
            if not (cv2.os.path.exists(prototxt_path) and cv2.os.path.exists(model_path)):
                print("OpenCV DNN face detector files not found. Using Haar Cascade instead.")
                self.face_detector = cv2.CascadeClassifier(
                    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                )
                self.use_dnn = False
            else:
                self.face_net = cv2.dnn.readNetFromTensorflow(model_path, prototxt_path)
                self.use_dnn = True
        except Exception as e:
            print(f"Warning: Could not initialize DNN face detector: {e}")
            print("Using Haar Cascade instead.")
            self.face_detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            self.use_dnn = False
        
        # Initialize facial landmark detector (simplified - using geometric estimation)
        # In a production system, you'd use dlib's 68-point predictor or similar
        self.landmark_detector = None
    
    def detect_face(self, frame):
        """
        Detect face in frame.
        
        Args:
            frame: Input BGR frame
            
        Returns:
            faces: List of face bounding boxes [(x, y, w, h), ...]
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        if self.use_dnn:
            # DNN-based detection
            h, w = frame.shape[:2]
            blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), [104, 117, 123])
            self.face_net.setInput(blob)
            detections = self.face_net.forward()
            
            faces = []
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > 0.5:
                    x1 = int(detections[0, 0, i, 3] * w)
                    y1 = int(detections[0, 0, i, 4] * h)
                    x2 = int(detections[0, 0, i, 5] * w)
                    y2 = int(detections[0, 0, i, 6] * h)
                    faces.append((x1, y1, x2 - x1, y2 - y1))
            return faces
        else:
            # Haar Cascade detection
            faces = self.face_detector.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )
            return [(x, y, w, h) for (x, y, w, h) in faces]
    
    def estimate_landmarks_geometric(self, frame, face_bbox):
        """
        Estimate facial landmarks using geometric heuristics.
        This is a simplified approach - for better accuracy, use dlib or MediaPipe.
        
        Args:
            frame: Input BGR frame
            face_bbox: Face bounding box (x, y, w, h)
            
        Returns:
            landmarks: Array of 6 key points [nose_tip, chin, left_eye, right_eye, left_mouth, right_mouth]
        """
        x, y, w, h = face_bbox
        h_frame, w_frame = frame.shape[:2]
        
        # Estimate landmark positions based on face geometry
        # These are approximate positions relative to face bbox
        landmarks = np.array([
            [x + w * 0.5, y + h * 0.4],        # Nose tip (approx)
            [x + w * 0.5, y + h * 0.85],       # Chin (approx)
            [x + w * 0.3, y + h * 0.35],       # Left eye (approx)
            [x + w * 0.7, y + h * 0.35],       # Right eye (approx)
            [x + w * 0.35, y + h * 0.65],      # Left mouth corner (approx)
            [x + w * 0.65, y + h * 0.65]       # Right mouth corner (approx)
        ], dtype=np.float32)
        
        # Use eye detection for better accuracy
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        
        face_roi = gray[y:y+h, x:x+w]
        eyes = eye_cascade.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=3)
        
        if len(eyes) >= 2:
            # Sort eyes by x position
            eyes = sorted(eyes, key=lambda e: e[0])
            left_eye = eyes[0]
            right_eye = eyes[1] if len(eyes) > 1 else eyes[0]
            
            # Update eye positions
            landmarks[2] = [x + left_eye[0] + left_eye[2]//2, 
                           y + left_eye[1] + left_eye[3]//2]
            landmarks[3] = [x + right_eye[0] + right_eye[2]//2, 
                          y + right_eye[1] + right_eye[3]//2]
        
        return landmarks
    
    def get_landmarks(self, frame):
        """
        Extract facial landmarks from frame.
        
        Args:
            frame: Input BGR frame
            
        Returns:
            landmarks: Array of landmark coordinates or None
        """
        faces = self.detect_face(frame)
        
        if len(faces) == 0:
            return None
        
        # Use the largest face
        face = max(faces, key=lambda f: f[2] * f[3])
        landmarks = self.estimate_landmarks_geometric(frame, face)
        
        return landmarks
    
    def estimate_pose(self, frame):
        """
        Estimate head pose angles (yaw, pitch, roll).
        
        Args:
            frame: Input BGR frame
            
        Returns:
            tuple: (success: bool, angles: dict or None)
                   angles contains 'yaw', 'pitch', 'roll' in degrees
        """
        landmarks_2d = self.get_landmarks(frame)
        
        if landmarks_2d is None or len(landmarks_2d) < 6:
            return False, None
        
        h, w = frame.shape[:2]
        
        # Camera intrinsic parameters (approximate, can be calibrated)
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)
        
        # Distortion coefficients (assuming no distortion)
        dist_coeffs = np.zeros((4, 1))
        
        # Scale 3D model points to match image scale
        # Use the distance between eyes as reference
        eye_distance = np.linalg.norm(landmarks_2d[2] - landmarks_2d[3])
        if eye_distance < 10:  # Sanity check
            return False, None
        
        scale_factor = eye_distance / 450.0  # Approximate distance in 3D model
        face_3d_scaled = self.FACE_3D_MODEL * scale_factor
        
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
        
        # Extract Euler angles (yaw, pitch, roll)
        sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
        
        singular = sy < 1e-6
        
        if not singular:
            yaw = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
            pitch = np.arctan2(-rotation_matrix[2, 0], sy)
            roll = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
        else:
            yaw = np.arctan2(-rotation_matrix[0, 1], rotation_matrix[1, 1])
            pitch = np.arctan2(-rotation_matrix[2, 0], sy)
            roll = 0
        
        # Convert to degrees
        yaw = np.degrees(yaw)
        pitch = np.degrees(pitch)
        roll = np.degrees(roll)
        
        return True, {
            'yaw': yaw,
            'pitch': pitch,
            'roll': roll
        }
    
    def process(self, frame):
        """
        Process frame and return head pose angles.
        
        Args:
            frame: Input BGR frame
            
        Returns:
            tuple: (success: bool, angles: dict or None)
        """
        return self.estimate_pose(frame)
