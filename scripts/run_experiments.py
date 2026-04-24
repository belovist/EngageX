import os
import sys
import time
import json
import cv2
import pandas as pd
import matplotlib.pyplot as plt

# Ensure core module is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.gatekeeper import Gatekeeper
from core.gaze_tracker import GazeTracker
from core.head_pose import HeadPoseEstimator
from core.score_calculator import AttentivenessScoreCalculator
from core.attention_monitor import AttentionMonitor

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'experiment_results')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def put_text(frame, text, y_pos=30, scale=0.7, color=(0, 255, 255), thickness=2):
    cv2.putText(frame, text, (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness)

def run_phase_1_latency():
    print("\n--- PHASE 1: AUTOMATED LATENCY & FPS PROFILING ---")
    gatekeeper = Gatekeeper(model_path="yolov8n.pt")
    head_pose = HeadPoseEstimator()
    gaze_tracker = GazeTracker()
    scorer = AttentivenessScoreCalculator()

    cap = cv2.VideoCapture(0)
    for _ in range(5): cap.read() # Warm up
    
    num_frames = 200
    latency_data = []
    
    print(f"Running for {num_frames} frames...")
    
    start_total = time.time()
    
    for i in range(num_frames):
        ret, frame = cap.read()
        if not ret: break
        
        frame_data = {}
        
        # Stage I: YOLO
        t0 = time.time()
        detected, cropped, bbox = gatekeeper.process(frame)
        t1 = time.time()
        frame_data['stage1_ms'] = (t1 - t0) * 1000
        
        if detected and cropped is not None:
            # Stage II: FaceMesh
            t2 = time.time()
            pose_success, angles = head_pose.process(cropped)
            t3 = time.time()
            frame_data['stage2_ms'] = (t3 - t2) * 1000
            
            # Stage III: L2CS
            t4 = time.time()
            gaze_success, gaze_vec = gaze_tracker.process(cropped)
            t5 = time.time()
            frame_data['stage3_ms'] = (t5 - t4) * 1000
            
            # Stage IV: Fusion
            t6 = time.time()
            metrics = scorer.calculate_with_metrics(
                head_pose_angles=angles if pose_success else None,
                gaze_vector=gaze_vec if gaze_success else None,
                emotion=None
            )
            t7 = time.time()
            frame_data['stage4_ms'] = (t7 - t6) * 1000
            
            latency_data.append(frame_data)
            
        cv2.imshow("Phase 1: Profiling (DO NOT CLOSE)", frame)
        cv2.waitKey(1)
        
    end_total = time.time()
    cap.release()
    cv2.destroyAllWindows()
    
    total_time = end_total - start_total
    avg_fps = num_frames / total_time
    
    df = pd.DataFrame(latency_data)
    summary = df.describe().loc[['min', 'mean', 'max']]
    print("\nLatency Summary (ms):")
    print(summary)
    print(f"\nAverage FPS: {avg_fps:.2f}")
    
    # Save latency results
    summary.to_csv(os.path.join(OUTPUT_DIR, 'latency_summary.csv'))
    with open(os.path.join(OUTPUT_DIR, 'fps_summary.json'), 'w') as f:
        json.dump({'avg_fps': avg_fps, 'total_frames': num_frames, 'total_time': total_time}, f)

def run_phase_2_and_3():
    print("\n--- PHASE 2 & 3: TIME-SERIES & ROBUSTNESS ---")
    monitor = AttentionMonitor(display=False)
    monitor.initialize_camera()
    
    time_series_data = []
    
    # Define the sequence of actions
    phases = [
        {"name": "Normal Behavior", "duration": 30, "msg": "Act normal (Look at camera)"},
        {"name": "Start Distraction", "duration": 15, "msg": "Look away continuously"},
        {"name": "Recovery", "duration": 15, "msg": "Look back at camera"},
        {"name": "Head Rotation", "duration": 15, "msg": "Turn head left/right (+- 30 deg)"},
        {"name": "Lighting Dim", "duration": 15, "msg": "Dim the lighting or cover camera slightly"},
        {"name": "Partial Occlusion", "duration": 15, "msg": "Cover your mouth/chin with hand"},
        {"name": "Blinking", "duration": 10, "msg": "Blink rapidly"},
        {"name": "Short Distraction", "duration": 10, "msg": "Look away for 1-2 seconds, then back"},
        {"name": "Multi-person", "duration": 10, "msg": "If possible, bring someone else in frame (optional)"},
    ]
    
    total_time = sum(p['duration'] for p in phases)
    print(f"Starting interactive tests. Total duration: ~{total_time} seconds.")
    
    start_time = time.time()
    
    for phase in phases:
        phase_start = time.time()
        print(f"\n>> Action: {phase['msg']} (for {phase['duration']}s)")
        
        while time.time() - phase_start < phase['duration']:
            ret, frame = monitor.cap.read()
            if not ret: break
            
            t = time.time() - start_time
            res = monitor.process_frame(frame)
            metrics = res.get('metrics', {})
            
            record = {
                'time': t,
                'phase': phase['name'],
                'raw_score': metrics.get('instantaneous_score', 0),
                'ema_score': metrics.get('smoothed_score', 0),
                'pose_score': metrics.get('pose_score', 0),
                'gaze_score': metrics.get('gaze_score', 0)
            }
            # Replace None with 0 for plotting
            for k in ['raw_score', 'ema_score', 'pose_score', 'gaze_score']:
                if record[k] is None: record[k] = 0
                
            time_series_data.append(record)
            
            # Draw instructions
            rem = int(phase['duration'] - (time.time() - phase_start))
            put_text(frame, f"Phase: {phase['name']} ({rem}s left)", y_pos=30)
            put_text(frame, f"Action: {phase['msg']}", y_pos=60, color=(0, 255, 0))
            
            if metrics.get('smoothed_score') is not None:
                put_text(frame, f"Score: {metrics['smoothed_score']:.2f}", y_pos=90, color=(255, 255, 255))
            
            cv2.imshow("Interactive Testing", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    monitor.cleanup()
    
    df = pd.DataFrame(time_series_data)
    df.to_csv(os.path.join(OUTPUT_DIR, 'time_series.csv'), index=False)
    
    # Plotting
    print("\nGenerating Plots...")
    
    # 1. Attention vs Time (Raw vs EMA)
    plt.figure(figsize=(12, 6))
    plt.plot(df['time'], df['raw_score'], label='Raw Score', alpha=0.3, color='blue')
    plt.plot(df['time'], df['ema_score'], label='EMA Score', linewidth=2, color='red')
    plt.title('Attention Score over Time (Fig 4 Equivalent)')
    plt.xlabel('Time (s)')
    plt.ylabel('Score')
    plt.legend()
    plt.grid(True)
    plt.savefig(os.path.join(OUTPUT_DIR, 'attention_time_series.png'))
    plt.close()
    
    # 2. Pose vs Gaze
    plt.figure(figsize=(12, 6))
    plt.plot(df['time'], df['pose_score'], label='Pose Score', alpha=0.7)
    plt.plot(df['time'], df['gaze_score'], label='Gaze Score', alpha=0.7)
    plt.title('Pose vs Gaze Contribution')
    plt.xlabel('Time (s)')
    plt.ylabel('Score Component')
    plt.legend()
    plt.grid(True)
    plt.savefig(os.path.join(OUTPUT_DIR, 'pose_vs_gaze.png'))
    plt.close()
    
    # 3. Bar chart of phases (Average EMA per phase)
    phase_means = df.groupby('phase', sort=False)['ema_score'].mean()
    plt.figure(figsize=(12, 6))
    phase_means.plot(kind='bar', color='skyblue')
    plt.title('Average Attention Score by Robustness Phase')
    plt.ylabel('Average EMA Score')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'robustness_summary.png'))
    plt.close()

if __name__ == '__main__':
    print("Welcome to EngageX Experiments!")
    run_phase_1_latency()
    print("\nPhase 1 Complete. Wait 3 seconds...")
    time.sleep(3)
    run_phase_2_and_3()
    print(f"\nAll experiments done! Results saved to {OUTPUT_DIR}")
