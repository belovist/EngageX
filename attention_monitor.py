"""
Real-Time Attention Monitoring System
Main pipeline integrating all stages: Gatekeeper → Head Pose → Gaze → Score
"""

import cv2
import numpy as np
from gatekeeper import Gatekeeper
from head_pose import HeadPoseEstimator
from gaze_tracker import GazeTracker
from score_calculator import AttentivenessScoreCalculator

class AttentionMonitor:
    """Main pipeline for real-time attention monitoring."""
    
    def __init__(self, 
                 camera_id=0,
                 yolo_model='yolov8n.pt',
                 gaze_model_path=None,
                 head_pose_weight=0.6,  # w1 = 0.6 (Pose Score weight)
                 gaze_weight=0.4,       # w2 = 0.4 (Gaze Score weight)
                 ema_alpha=0.3,         # α = 0.3 (EMA smoothing factor)
                 display=True):
        
        # Initialize components
        self.gatekeeper = Gatekeeper(model_path=yolo_model)
        self.head_pose_estimator = HeadPoseEstimator()
        self.gaze_tracker = GazeTracker(model_path=gaze_model_path)
        self.score_calculator = AttentivenessScoreCalculator(
            head_pose_weight=head_pose_weight,
            gaze_weight=gaze_weight,
            ema_alpha=ema_alpha
        )
        
        # Camera setup
        self.camera_id = camera_id
        self.cap = None
        self.display = display
        
        # Base Statistics
        self.frame_count = 0
        self.person_detected_count = 0
        self.head_pose_success_count = 0
        self.gaze_success_count = 0
        
        # NEW: Session Analytics Tracking
        self.session_scores = []
        self.status_counts = {
            "Highly Attentive": 0,
            "Moderately Attentive": 0,
            "Distracted": 0
        }

    def initialize_camera(self):
        """Initialize webcam capture."""
        self.cap = cv2.VideoCapture(self.camera_id)
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open camera {self.camera_id}")
        
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    # NEW: Helper function to classify the score
    def get_status_label(self, score):
        if score >= 0.80:
            return "Highly Attentive"
        elif score >= 0.50:
            return "Moderately Attentive"
        else:
            return "Distracted"

    def draw_info(self, frame, bbox, head_pose_angles, gaze_vector, scores):
        """Draw information overlay on frame."""
        h, w = frame.shape[:2]
        
        if bbox is not None:
            x1, y1, x2, y2 = bbox.astype(int)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, "Person Detected", (x1, y1 - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        if head_pose_angles:
            yaw, pitch, roll = head_pose_angles['yaw'], head_pose_angles['pitch'], head_pose_angles['roll']
            text = f"Head: Yaw={yaw:.1f} Pitch={pitch:.1f} Roll={roll:.1f}"
            cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        if gaze_vector:
            yaw, pitch = gaze_vector['yaw'], gaze_vector['pitch']
            text = f"Gaze: Yaw={yaw:.1f} Pitch={pitch:.1f}"
            cv2.putText(frame, text, (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        inst_score, smooth_score = scores
        if inst_score is not None:
            color = (0, int(255 * smooth_score), int(255 * (1 - smooth_score)))
            
            bar_width, bar_height = 200, 20
            bar_x, bar_y = 10, h - 40
            
            cv2.rectangle(frame, (bar_x, bar_y), 
                         (bar_x + bar_width, bar_y + bar_height), (50, 50, 50), -1)
            
            score_width = int(bar_width * smooth_score)
            cv2.rectangle(frame, (bar_x, bar_y), 
                         (bar_x + score_width, bar_y + bar_height), color, -1)
            
            # Fetch the text label for the UI
            status_text = self.get_status_label(smooth_score)
            score_text = f"{status_text}: {int(smooth_score * 100)}%"
            cv2.putText(frame, score_text, (bar_x, bar_y - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        stats_text = (f"Frames: {self.frame_count} | Person: {self.person_detected_count}")
        cv2.putText(frame, stats_text, (10, h - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

    def process_frame(self, frame):
        """Process a single frame through the pipeline."""
        self.frame_count += 1
        
        person_detected, cropped_frame, bbox = self.gatekeeper.process(frame)
        if not person_detected:
            return {'person_detected': False, 'bbox': None, 'head_pose_angles': None, 
                    'gaze_vector': None, 'scores': (None, None)}
        
        self.person_detected_count += 1
        
        head_pose_success, head_pose_angles = self.head_pose_estimator.process(cropped_frame)
        if head_pose_success: self.head_pose_success_count += 1
        
        gaze_success, gaze_vector = self.gaze_tracker.process(cropped_frame)
        if gaze_success: self.gaze_success_count += 1
        
        instantaneous_score, smoothed_score = self.score_calculator.calculate(
            head_pose_angles=head_pose_angles,
            gaze_vector=gaze_vector,
            emotion=None
        )
        
        return {
            'person_detected': True,
            'bbox': bbox,
            'head_pose_angles': head_pose_angles,
            'gaze_vector': gaze_vector,
            'scores': (instantaneous_score, smoothed_score)
        }

    def run(self):
        """Run the main monitoring loop."""
        self.initialize_camera()
        print("\nStarting Attention Monitoring System...")
        print("Press 'q' to quit and view session summary.\n")
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret: break
                
                results = self.process_frame(frame)
                inst_score, smooth_score = results['scores']
                
                # NEW: Track stats if a score was successfully calculated
                if smooth_score is not None:
                    self.session_scores.append(smooth_score)
                    current_status = self.get_status_label(smooth_score)
                    self.status_counts[current_status] += 1
                    
                    # UPDATED: Print score and status periodically
                    if self.frame_count % 30 == 0:
                        print(f"Frame {self.frame_count}: Score = {smooth_score:.2f}  --->  [{current_status}]")
                
                if self.display:
                    self.draw_info(frame, results['bbox'], results['head_pose_angles'], 
                                   results['gaze_vector'], results['scores'])
                    cv2.imshow('Attention Monitor', frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'): break
                        
        except KeyboardInterrupt:
            print("\nInterrupted by user")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources and print final summary."""
        if self.cap is not None:
            self.cap.release()
        cv2.destroyAllWindows()
        
        # NEW: Final Session Summary Generation
        print("\n==================================================")
        print("              FINAL SESSION SUMMARY               ")
        print("==================================================")
        print(f"Total frames processed:  {self.frame_count}")
        print(f"Frames with person:      {self.person_detected_count}")
        
        if len(self.session_scores) > 0:
            avg_score = sum(self.session_scores) / len(self.session_scores)
            total_scored_frames = len(self.session_scores)
            
            print(f"\n[ Overall Performance ]")
            print(f"Average Attention Score: {avg_score * 100:.1f}%")
            
            print(f"\n[ Time Breakdown ]")
            for status, count in self.status_counts.items():
                percentage = (count / total_scored_frames) * 100
                print(f"{status.ljust(20)}: {percentage:>5.1f}%  ({count} frames)")
        else:
            print("\n[!] No valid attention data was collected during this session.")
        
        print("==================================================\n")


def main():
    monitor = AttentionMonitor(
        camera_id=0,
        display=True,
        head_pose_weight=0.6,
        gaze_weight=0.4,
        ema_alpha=0.3
    )
    monitor.run()

if __name__ == '__main__':
    main()