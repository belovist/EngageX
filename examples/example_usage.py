"""
Example usage of the Attention Monitoring System
Demonstrates different ways to use the system

Run from project root:
    python -m examples.example_usage
"""

import sys
from pathlib import Path

# Add project root to path for imports
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import cv2
from core.attention_monitor import AttentionMonitor


def example_basic_usage():
    """Basic usage: Run with default settings."""
    print("Example 1: Basic Usage")
    print("=" * 50)
    
    monitor = AttentionMonitor(
        camera_id=0,
        display=True
    )
    monitor.run()


def example_custom_weights():
    """Example with custom weights for score calculation."""
    print("Example 2: Custom Weights")
    print("=" * 50)
    
    monitor = AttentionMonitor(
        camera_id=0,
        head_pose_weight=0.6,  # More weight on head pose
        gaze_weight=0.4,        # Less weight on gaze
        ema_alpha=0.2,          # More smoothing
        display=True
    )
    monitor.run()


def example_single_frame_processing():
    """Example: Process frames one at a time."""
    print("Example 3: Single Frame Processing")
    print("=" * 50)
    
    monitor = AttentionMonitor(display=False)
    monitor.initialize_camera()
    
    frame_count = 0
    max_frames = 100
    
    try:
        while frame_count < max_frames:
            ret, frame = monitor.cap.read()
            if not ret:
                break
            
            # Process frame
            results = monitor.process_frame(frame)
            
            # Print results every 10 frames
            if frame_count % 10 == 0:
                inst_score, smooth_score = results['scores']
                if smooth_score is not None:
                    print(f"Frame {frame_count}: Score = {smooth_score:.3f}")
                    if results['head_pose_angles']:
                        hp = results['head_pose_angles']
                        print(f"  Head Pose: Yaw={hp['yaw']:.1f}, "
                              f"Pitch={hp['pitch']:.1f}, Roll={hp['roll']:.1f}")
                    if results['gaze_vector']:
                        gv = results['gaze_vector']
                        print(f"  Gaze: Yaw={gv['yaw']:.1f}, Pitch={gv['pitch']:.1f}")
            
            frame_count += 1
    
    finally:
        monitor.cleanup()
        print(f"\nProcessed {frame_count} frames")


def example_with_video_file():
    """Example: Process video file instead of webcam."""
    print("Example 4: Video File Processing")
    print("=" * 50)
    
    video_path = "input_video.mp4"  # Change to your video path
    
    # Initialize components
    from core.gatekeeper import Gatekeeper
    from core.head_pose import HeadPoseEstimator
    from core.gaze_tracker import GazeTracker
    from core.score_calculator import AttentivenessScoreCalculator
    
    gatekeeper = Gatekeeper()
    head_pose_estimator = HeadPoseEstimator()
    gaze_tracker = GazeTracker(device='cpu')
    score_calculator = AttentivenessScoreCalculator()
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return
    
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process through pipeline
            person_detected, cropped_frame, bbox = gatekeeper.process(frame)
            
            if person_detected:
                head_pose_success, head_pose_angles = head_pose_estimator.process(cropped_frame)
                landmarks = head_pose_estimator.get_landmarks(cropped_frame) if head_pose_success else None
                gaze_success, gaze_vector = gaze_tracker.process(cropped_frame, landmarks)
                
                inst_score, smooth_score = score_calculator.calculate(
                    head_pose_angles if head_pose_success else None,
                    gaze_vector if gaze_success else None
                )
                
                if frame_count % 30 == 0 and smooth_score is not None:
                    print(f"Frame {frame_count}: Attentiveness = {smooth_score:.3f}")
            
            frame_count += 1
    
    finally:
        cap.release()
        print(f"\nProcessed {frame_count} frames from video")


if __name__ == '__main__':
    print("Attention Monitoring System - Usage Examples")
    print("=" * 50)
    print("\nChoose an example:")
    print("1. Basic Usage (webcam with display)")
    print("2. Custom Weights")
    print("3. Single Frame Processing")
    print("4. Video File Processing")
    
    choice = input("\nEnter choice (1-4): ").strip()
    
    if choice == '1':
        example_basic_usage()
    elif choice == '2':
        example_custom_weights()
    elif choice == '3':
        example_single_frame_processing()
    elif choice == '4':
        example_with_video_file()
    else:
        print("Invalid choice. Running basic example...")
        example_basic_usage()
