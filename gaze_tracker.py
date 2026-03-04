"""
Stage III: Gaze Tracking using L2CS-Net (ONNX version)
Fine-grained attention detection via gaze vector estimation.

REQUIREMENT: L2CS-Net ONNX model for CPU speed.
Processes full cropped face (224x224) not just eye regions.
"""

import os
import cv2
import numpy as np

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    raise ImportError(
        "onnxruntime is required for L2CS-Net ONNX inference. "
        "Install with: pip install onnxruntime"
    )


def softmax(x):
    """Numerically stable softmax (REQUIRED for L2CS-Net)"""
    e_x = np.exp(x - np.max(x))
    return e_x / np.sum(e_x)


class GazeTracker:
    """
    L2CS-Net ONNX-based gaze tracking.
    Processes full cropped face image (224x224) to regress gaze vectors.
    """
    
    def __init__(self, model_path=None, input_size=224, num_bins=90):
        """
        Initialize L2CS-Net ONNX gaze tracker.
        """
        if not ONNX_AVAILABLE:
            raise ImportError("onnxruntime is required but not installed")
        
        self.input_size = input_size
        self.num_bins = num_bins
        
        if model_path is None:
            model_path = 'l2cs_net.onnx'
        
        if os.path.exists(model_path):
            self.session = ort.InferenceSession(
                model_path,
                providers=['CPUExecutionProvider']
            )
            self.model_loaded = True
            
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [o.name for o in self.session.get_outputs()]
        else:
            print(f"Warning: L2CS-Net ONNX model not found at {model_path}")
            print("Gaze tracking will use placeholder values.")
            self.model_loaded = False
            self.session = None
        
        # ✅ FIX: L2CS-Net uses 90 bins in [-180, 180]
        self.yaw_bins = np.linspace(-180, 180, self.num_bins)
        self.pitch_bins = np.linspace(-180, 180, self.num_bins)
    
    def preprocess_face(self, face_frame):
        resized = cv2.resize(face_frame, (self.input_size, self.input_size))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        rgb_float = rgb.astype(np.float32) / 255.0
        
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        
        normalized = (rgb_float - mean) / std
        chw = np.transpose(normalized, (2, 0, 1))
        batch_input = np.expand_dims(chw, axis=0)
        
        return batch_input.astype(np.float32)
    
    def predict_gaze(self, face_frame):
        if not self.model_loaded:
            return 0.0, 0.0
        
        input_tensor = self.preprocess_face(face_frame)
        
        outputs = self.session.run(
            self.output_names,
            {self.input_name: input_tensor}
        )
        
        yaw_logits = outputs[0][0]    # shape: (90,)
        pitch_logits = outputs[1][0]  # shape: (90,)
        
        # ✅ FIX: L2CS-Net requires expectation, NOT argmax
        yaw_prob = softmax(yaw_logits)
        pitch_prob = softmax(pitch_logits)
        
        yaw = np.sum(yaw_prob * self.yaw_bins)
        pitch = np.sum(pitch_prob * self.pitch_bins)
        
        return yaw, pitch
    
    def calculate_gaze_score(self, yaw, pitch, target_yaw=0.0, target_pitch=0.0):
        yaw_deviation = abs(yaw - target_yaw)
        pitch_deviation = abs(pitch - target_pitch)
        
        yaw_threshold = 30.0
        pitch_threshold = 30.0
        
        yaw_score = max(0.0, 1.0 - (yaw_deviation / yaw_threshold))
        pitch_score = max(0.0, 1.0 - (pitch_deviation / pitch_threshold))
        
        gaze_score = 0.5 * yaw_score + 0.5 * pitch_score
        
        return np.clip(gaze_score, 0.0, 1.0)
    
    def estimate_gaze_vector(self, face_frame):
        if face_frame is None or face_frame.size == 0:
            return False, None
        
        yaw, pitch = self.predict_gaze(face_frame)
        gaze_score = self.calculate_gaze_score(yaw, pitch)
        
        yaw_rad = np.radians(yaw)
        pitch_rad = np.radians(pitch)
        
        gaze_vector = np.array([
            np.sin(yaw_rad) * np.cos(pitch_rad),
            -np.sin(pitch_rad),
            np.cos(yaw_rad) * np.cos(pitch_rad)
        ], dtype=np.float32)
        
        norm = np.linalg.norm(gaze_vector)
        if norm > 1e-6:
            gaze_vector = gaze_vector / norm
        else:
            gaze_vector = np.array([0.0, 0.0, 1.0], dtype=np.float32)
        
        return True, {
            'yaw': float(yaw),
            'pitch': float(pitch),
            'gaze_score': float(gaze_score),
            'vector': gaze_vector
        }
    
    def process(self, face_frame):
        return self.estimate_gaze_vector(face_frame)
