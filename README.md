# Real-Time Attention Monitoring System

A lightweight, CPU-optimized system for real-time attention monitoring using YOLOv8 Nano, MediaPipe Face Mesh, and L2CS-Net for gaze tracking.

## Architecture Overview

The system follows a linear pipeline architecture:

```
Input Frame → YOLO Gatekeeper → Head Pose → Gaze Tracking → Score Calculation
```

### Components

1. **Stage I: Gatekeeper (YOLOv8 Nano)**
   - Person detection and presence verification
   - ROI cropping to focus on the user's face

2. **Stage II: Head Pose Estimation (MediaPipe Face Mesh)**
   - Calculates yaw, pitch, and roll angles using Perspective-n-Point (PnP)
   - Determines coarse visual focus of attention

3. **Stage III: Gaze Tracking (L2CS-Net)**
   - Fine-grained attention detection
   - Distinguishes between facing screen vs. looking at camera
   - Outputs gaze vectors

4. **Stage IV: Attentiveness Score**
   - Fuses head pose and gaze data into a single metric
   - Applies Exponential Moving Average (EMA) smoothing to prevent jittering

## Features

- ✅ **Lightweight**: Optimized for CPU-only execution
- ✅ **Real-time**: Processes video feed frame-by-frame
- ✅ **Local Execution**: No cloud dependencies
- ✅ **YOLO Nano**: Fastest YOLO variant for person detection
- ✅ **MediaPipe**: Extremely fast facial landmark detection
- ✅ **L2CS-Net**: Calibration-free gaze estimation

## Requirements

- Python 3.8+
- Webcam/Camera
- CPU (GPU optional, not required)

## Installation

1. **Clone or download this repository**

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Download YOLOv8 Nano model** (automatically downloaded on first run):
   - The model will be automatically downloaded by Ultralytics when you first run the system

4. **Optional: Download L2CS-Net pretrained weights**:
   - If you have pretrained L2CS-Net weights, place them in the project directory
   - The system will work without pretrained weights (uses random initialization)

## Usage

### Basic Usage

Run the main monitoring script:

```bash
python attention_monitor.py
```

This will:
- Open your default webcam (camera 0)
- Display the video feed with overlays
- Show real-time attentiveness scores
- Press 'q' to quit

### Programmatic Usage

```python
from attention_monitor import AttentionMonitor

# Initialize monitor
monitor = AttentionMonitor(
    camera_id=0,              # Webcam device ID
    display=True,              # Show video feed
    head_pose_weight=0.4,     # Weight for head pose in score
    gaze_weight=0.6,          # Weight for gaze in score
    ema_alpha=0.3             # EMA smoothing factor (0-1)
)

# Run monitoring
monitor.run()
```

### Custom Configuration

```python
from attention_monitor import AttentionMonitor

monitor = AttentionMonitor(
    camera_id=0,
    yolo_model='yolov8n.pt',      # YOLOv8 Nano model path
    gaze_model_path='l2cs_weights.pth',  # Optional L2CS-Net weights
    head_pose_weight=0.5,         # Adjust weights as needed
    gaze_weight=0.5,
    ema_alpha=0.2,                 # Lower = more smoothing
    display=True
)
monitor.run()
```

### Processing Single Frames

```python
import cv2
from attention_monitor import AttentionMonitor

monitor = AttentionMonitor(display=False)
monitor.initialize_camera()

ret, frame = monitor.cap.read()
results = monitor.process_frame(frame)

print(f"Attentiveness Score: {results['scores'][1]:.3f}")
print(f"Head Pose: {results['head_pose_angles']}")
print(f"Gaze Vector: {results['gaze_vector']}")
```

## Score Interpretation

The attentiveness score ranges from **0.0 to 1.0**:

- **0.8 - 1.0**: Highly attentive (facing forward, looking at screen)
- **0.5 - 0.8**: Moderately attentive
- **0.0 - 0.5**: Distracted (head turned away, not looking at screen)

The score is calculated as:
```
Score = w_hp × HeadPose_Score + w_g × Gaze_Score
```

Where:
- `w_hp` = head pose weight (default: 0.4)
- `w_g` = gaze weight (default: 0.6)
- HeadPose_Score = based on yaw, pitch, roll angles
- Gaze_Score = based on alignment with target direction

## Project Structure

```
.
├── attention_monitor.py    # Main pipeline script
├── gatekeeper.py           # Stage I: YOLOv8 Nano person detection
├── head_pose.py            # Stage II: MediaPipe head pose estimation
├── gaze_tracker.py         # Stage III: L2CS-Net gaze tracking
├── score_calculator.py     # Stage IV: Score calculation and smoothing
├── requirements.txt        # Python dependencies
└── README.md              # This file
```

## Performance Notes

- **YOLOv8 Nano**: ~10-30ms per frame on CPU
- **MediaPipe Face Mesh**: ~5-10ms per frame
- **L2CS-Net**: ~20-50ms per frame on CPU (depending on model size)
- **Total Pipeline**: ~35-90ms per frame (~11-28 FPS)

For better performance:
- Reduce input resolution
- Use GPU if available (set `device='cuda'` in GazeTracker)
- Adjust EMA alpha for smoother but slower response

## Troubleshooting

### MediaPipe `solutions` module not found
**Error:** `AttributeError: module 'mediapipe' has no attribute 'solutions'`

**Solution:** The system will automatically fall back to OpenCV-based face detection. However, for better accuracy, you can try:

1. **Reinstall MediaPipe:**
   ```bash
   pip uninstall mediapipe -y
   pip install mediapipe==0.10.0
   ```

2. **Or use the OpenCV fallback** (already implemented):
   - The system will automatically use OpenCV Haar Cascades if MediaPipe solutions is unavailable
   - This works but is less accurate than MediaPipe Face Mesh

3. **Verify MediaPipe installation:**
   ```python
   python -c "import mediapipe as mp; print(hasattr(mp, 'solutions'))"
   ```

### Camera not opening
- Check camera permissions
- Try different `camera_id` values (0, 1, 2, etc.)
- Ensure no other application is using the camera

### Low FPS
- Reduce camera resolution in `attention_monitor.py`
- Use a smaller YOLO model variant
- Disable display (`display=False`)

### Poor gaze tracking accuracy
- Ensure good lighting conditions
- Face should be clearly visible
- Consider using pretrained L2CS-Net weights

### Person not detected
- Check lighting conditions
- Ensure person is in frame
- Adjust `confidence_threshold` in `Gatekeeper` class

## License

This project is provided as-is for educational and research purposes.

## Acknowledgments

- **YOLOv8**: Ultralytics (https://github.com/ultralytics/ultralytics)
- **MediaPipe**: Google (https://mediapipe.dev/)
- **L2CS-Net**: Inspired by L2CS-Net architecture for gaze estimation

## Future Improvements

- [ ] Add support for multiple faces
- [ ] Implement calibration routine for better gaze accuracy
- [ ] Add emotion detection component (currently set to 0 weight)
- [ ] Export scores to CSV/log file
- [ ] Add web interface for remote monitoring
- [ ] Support for video file input (not just webcam)
