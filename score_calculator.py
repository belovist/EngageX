"""
Stage IV: Attentiveness Score Calculation
Fuses head pose and gaze data into a single metric with EMA smoothing.
"""

import numpy as np


class AttentivenessScoreCalculator:
    """Calculates attentiveness score from head pose and gaze data."""
    
    def __init__(self, 
                 head_pose_weight=0.6,  # w1 = 0.6 (Pose Score weight)
                 gaze_weight=0.4,       # w2 = 0.4 (Gaze Score weight)
                 emotion_weight=0.0,    # Set to 0 for lightweight model
                 ema_alpha=0.3,         # α = 0.3 for EMA smoothing
                 target_direction=np.array([0, 0, 1])):  # Looking straight ahead
        """
        Initialize score calculator.
        
        Args:
            head_pose_weight: Weight for head pose component (0-1)
            gaze_weight: Weight for gaze component (0-1)
            emotion_weight: Weight for emotion component (set to 0)
            ema_alpha: EMA smoothing factor (0-1, higher = less smoothing)
            target_direction: Target gaze direction vector (normalized)
        """
        self.head_pose_weight = head_pose_weight
        self.gaze_weight = gaze_weight
        self.emotion_weight = emotion_weight
        self.ema_alpha = ema_alpha
        self.target_direction = target_direction / np.linalg.norm(target_direction)
        
        # Normalize weights
        total_weight = head_pose_weight + gaze_weight + emotion_weight
        if total_weight > 0:
            self.head_pose_weight /= total_weight
            self.gaze_weight /= total_weight
            self.emotion_weight /= total_weight
        
        # EMA state
        self.smoothed_score = None
    
    def calculate_head_pose_score(self, head_pose_angles):
        """
        Calculate Pose Score from head pose angles.
        Uses pre-calculated pose_score if available, otherwise computes it.
        
        Args:
            head_pose_angles: Dict with 'yaw', 'pitch', 'roll' (degrees) and optionally 'pose_score'
            
        Returns:
            pose_score: Float between 0 and 1
        """
        # If pose_score is already calculated (from head_pose.py), use it
        if 'pose_score' in head_pose_angles:
            return head_pose_angles['pose_score']
        
        # Otherwise calculate it (fallback)
        yaw = abs(head_pose_angles['yaw'])
        pitch = abs(head_pose_angles['pitch'])
        roll = abs(head_pose_angles['roll'])
        
        yaw_threshold = 30.0
        pitch_threshold = 30.0
        roll_threshold = 15.0
        
        yaw_score = max(0, 1.0 - (yaw / yaw_threshold))
        pitch_score = max(0, 1.0 - (pitch / pitch_threshold))
        roll_score = max(0, 1.0 - (roll / roll_threshold))
        
        pose_score = 0.4 * yaw_score + 0.4 * pitch_score + 0.2 * roll_score
        
        return np.clip(pose_score, 0.0, 1.0)
    
    def calculate_gaze_score(self, gaze_vector):
        """
        Calculate Gaze Score from gaze vector.
        Uses pre-calculated gaze_score if available, otherwise computes it.
        
        Args:
            gaze_vector: Dict with 'vector' (normalized 3D array) and optionally 'gaze_score'
            
        Returns:
            gaze_score: Float between 0 and 1
        """
        # If gaze_score is already calculated (from gaze_tracker.py), use it
        if 'gaze_score' in gaze_vector:
            return gaze_vector['gaze_score']
        
        # Otherwise calculate from vector alignment (fallback)
        gaze_dir = gaze_vector['vector']
        cosine_sim = np.dot(gaze_dir, self.target_direction)
        gaze_score = (cosine_sim + 1.0) / 2.0
        
        return np.clip(gaze_score, 0.0, 1.0)
    
    def calculate_instantaneous_score(self, head_pose_angles=None, gaze_vector=None, emotion=None):
        """
        Calculate instantaneous Attention Score S(t) using exact formula:
        S(t) = w1 × Pose_Score + w2 × Gaze_Score
        
        Where:
        - w1 = 0.6 (head_pose_weight)
        - w2 = 0.4 (gaze_weight)
        
        Args:
            head_pose_angles: Dict with head pose angles or None
            gaze_vector: Dict with gaze vector or None
            emotion: Emotion score (not used, set to 0)
            
        Returns:
            score: Float between 0 and 1, or None if insufficient data
        """
        pose_score = None
        gaze_score = None
        
        # Get Pose Score
        if head_pose_angles is not None:
            pose_score = self.calculate_head_pose_score(head_pose_angles)
        
        # Get Gaze Score
        if gaze_vector is not None:
            gaze_score = self.calculate_gaze_score(gaze_vector)
        
        # Need at least one component
        if pose_score is None and gaze_score is None:
            return None
        
        # Calculate weighted sum: S(t) = w1 × Pose_Score + w2 × Gaze_Score
        # If one component is missing, use only the available one
        if pose_score is not None and gaze_score is not None:
            instantaneous_score = (self.head_pose_weight * pose_score + 
                                  self.gaze_weight * gaze_score)
        elif pose_score is not None:
            instantaneous_score = pose_score  # Use only pose if gaze unavailable
        else:
            instantaneous_score = gaze_score  # Use only gaze if pose unavailable
        
        return np.clip(instantaneous_score, 0.0, 1.0)
    
    def apply_ema_smoothing(self, instantaneous_score):
        """
        Apply Exponential Moving Average (EMA) smoothing:
        Final_Score_t = α × S(t) + (1-α) × Final_Score_{t-1}
        
        Where α = 0.3 (ema_alpha)
        
        Args:
            instantaneous_score: Current frame score S(t)
            
        Returns:
            smoothed_score: EMA-smoothed Final_Score_t
        """
        if instantaneous_score is None:
            return self.smoothed_score
        
        if self.smoothed_score is None:
            # Initialize with first score
            self.smoothed_score = instantaneous_score
        else:
            # EMA formula: Final_Score_t = α × S(t) + (1-α) × Final_Score_{t-1}
            self.smoothed_score = (self.ema_alpha * instantaneous_score + 
                                  (1.0 - self.ema_alpha) * self.smoothed_score)
        
        return self.smoothed_score
    
    def calculate(self, head_pose_angles=None, gaze_vector=None, emotion=None):
        """
        Calculate and return smoothed attentiveness score.
        
        Args:
            head_pose_angles: Dict with head pose angles or None
            gaze_vector: Dict with gaze vector or None
            emotion: Emotion score (not used)
            
        Returns:
            tuple: (instantaneous_score, smoothed_score)
        """
        instantaneous_score = self.calculate_instantaneous_score(
            head_pose_angles, gaze_vector, emotion
        )
        smoothed_score = self.apply_ema_smoothing(instantaneous_score)
        
        return instantaneous_score, smoothed_score
    
    def reset(self):
        """Reset EMA state."""
        self.smoothed_score = None
