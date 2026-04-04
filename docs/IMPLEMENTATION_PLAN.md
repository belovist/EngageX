# Lightweight Attention Span Monitoring System - Implementation Plan

## Runtime and Integration Update (April 2026)

This section defines the current working integration layout used by the team.

### Local service map

- Frontend dev server: `127.0.0.1:3000`
- Host route: `http://127.0.0.1:3000/host`
- Participant route: `http://127.0.0.1:3000/participant`
- Unified API backend: `127.0.0.1:8000` (`server.py`)

Single backend note:
- Host and participant UIs both target the same backend.
- `attention-monitor/backend/main.py` is now a compatibility wrapper to the unified app.

### Recommended startup

Windows launcher from repo root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-engagex-all.ps1 -CleanPorts
```

Virtual camera mode:

```powershell
.\start-engagex-all.ps1 -UseVirtualCam -CleanPorts
```

macOS/Linux launcher from repo root:

```bash
chmod +x ./start-engagex-all.sh
./start-engagex-all.sh
```

macOS/Linux with participant client:

```bash
./start-engagex-all.sh --with-participant
```

### Participant runtime modes

1. Score-only mode
- Runs `distributed_client.py`
- Captures webcam locally and sends score events to backend `:8000`

2. Meeting-compatible mode
- Runs `attention-monitor/client-desktop/run_virtual_cam.py`
- Captures webcam, runs inference, sends scores, and publishes frames to a virtual camera device
- Meeting apps should select the virtual camera device

### Backend/API ownership

- Backend process never opens webcam by itself.
- Camera access belongs to participant clients or browser preview.
- This is why camera permission prompts appear only when those clients start, not when backend starts.

### Camera ownership rule

Only one process should own the physical webcam at a time. If Python inference is active, browser preview may fail with camera-in-use errors.

## Architecture Overview

This system implements a **4-stage linear pipeline** for real-time attention monitoring:

```
Webcam Feed → Stage I (YOLOv8 Nano) → Stage II (MediaPipe) → Stage III (L2CS-Net ONNX) → Stage IV (Score Fusion)
```

---

## Stage I: The Gatekeeper (YOLOv8 Nano)

### Purpose
- **Person Detection**: Filter frames to only process when a person is present
- **ROI Extraction**: Crop the person bounding box to maximize resolution for downstream stages

### Implementation Details

**File**: `gatekeeper.py`

**Key Components**:
1. **Model Loading**: `YOLO('yolov8n.pt')` - Ultralytics YOLOv8 Nano
2. **Class Filtering**: Only process detections with `class_id == 0` (Person class)
3. **Presence Verification**: If `Person_Count == 0`, return early to save CPU
4. **ROI Cropping**: Extract bounding box `(x1, y1, x2, y2)` and crop frame with padding

**Pseudo-code**:
```python
def process(frame):
    # Run YOLOv8 Nano inference
    results = model(frame)
    
    # Filter for Person class (ID = 0)
    for detection in results:
        if detection.class_id == 0 and detection.confidence >= threshold:
            bbox = detection.bbox  # [x1, y1, x2, y2]
            cropped_frame = crop(frame, bbox, padding=20)
            return True, cropped_frame, bbox
    
    # No person detected - pause execution
    return False, None, None
```

**Output**: `(person_detected: bool, cropped_frame: np.array, bbox: np.array)`

---

## Stage II: Head Pose Estimation (MediaPipe Face Mesh)

### Purpose
- **Coarse Attention**: Determine Visual Focus of Attention (VFOA) via head orientation
- **468 Landmarks**: Use MediaPipe Face Mesh for high-precision facial landmark detection

### Implementation Details

**File**: `head_pose.py`

**Key Components**:
1. **MediaPipe Face Mesh**: `mp.solutions.face_mesh.FaceMesh()` with 468 landmarks
2. **Landmark Extraction**: Extract 6 key points (nose, chin, eyes, mouth corners)
3. **PnP Algorithm**: Use `cv2.solvePnP()` with standard 3D face model
4. **Pose Score**: Normalized score (0.0-1.0) based on head deviation

**Pseudo-code**:
```python
def estimate_pose(cropped_frame):
    # Run MediaPipe Face Mesh on cropped face
    rgb_frame = BGR_to_RGB(cropped_frame)
    results = face_mesh.process(rgb_frame)
    
    # Extract 2D landmarks (6 key points)
    landmarks_2d = extract_landmarks(results, indices=[1, 175, 33, 263, 61, 291])
    
    # 3D face model points (standard model)
    face_3d = [[0, 0, 0], [0, -330, -65], [-225, 170, -135], 
               [225, 170, -135], [-150, -150, -125], [150, -150, -125]]
    
    # Scale 3D model based on inter-eye distance
    eye_distance = norm(landmarks_2d[left_eye] - landmarks_2d[right_eye])
    scale_factor = eye_distance / 450.0
    face_3d_scaled = face_3d * scale_factor
    
    # Solve PnP
    camera_matrix = estimate_camera_intrinsics(frame_width, frame_height)
    success, rotation_vector, translation_vector = cv2.solvePnP(
        face_3d_scaled, landmarks_2d, camera_matrix, dist_coeffs
    )
    
    # Extract Euler angles (yaw, pitch, roll)
    rotation_matrix = cv2.Rodrigues(rotation_vector)
    yaw, pitch, roll = extract_euler_angles(rotation_matrix)
    
    # Calculate Pose Score (0.0-1.0)
    pose_score = calculate_pose_score(yaw, pitch, roll)
    
    return success, {yaw, pitch, roll, pose_score}
```

**Output**: `(success: bool, {yaw: float, pitch: float, roll: float, pose_score: float})`

**Pose Score Calculation**:
- Thresholds: yaw=30°, pitch=30°, roll=15°
- Score decreases linearly as angles exceed thresholds
- Formula: `pose_score = 0.4*yaw_score + 0.4*pitch_score + 0.2*roll_score`

---

## Stage III: Gaze Tracking (L2CS-Net ONNX)

### Purpose
- **Fine-grained Attention**: Distinguish between looking at screen vs. phone/away
- **ONNX Runtime**: CPU-optimized inference for real-time performance

### Implementation Details

**File**: `gaze_tracker.py`

**Key Components**:
1. **ONNX Model**: Load L2CS-Net ONNX model (`l2cs_net.onnx`)
2. **Full Face Processing**: Resize cropped face to 224×224 (not just eye regions)
3. **Gaze Regression**: Model outputs yaw and pitch angles via classification (28 bins)
4. **Gaze Score**: Normalized score (0.0-1.0) based on alignment with target direction

**Pseudo-code**:
```python
def estimate_gaze(cropped_face_frame):
    # Preprocess: Resize to 224x224 and normalize
    resized = resize(cropped_face_frame, (224, 224))
    rgb = BGR_to_RGB(resized)
    normalized = (rgb / 255.0 - mean) / std  # ImageNet normalization
    input_tensor = transpose(normalized, CHW)  # [1, 3, 224, 224]
    
    # Run ONNX inference
    outputs = onnx_session.run(input_tensor)
    yaw_logits, pitch_logits = outputs[0], outputs[1]
    
    # Convert logits to angles (28 bins: -90° to +90°)
    yaw_idx = argmax(yaw_logits)
    pitch_idx = argmax(pitch_logits)
    yaw = yaw_bins[yaw_idx]  # -90 to +90 degrees
    pitch = pitch_bins[pitch_idx]  # -90 to +90 degrees
    
    # Calculate Gaze Score (0.0-1.0)
    gaze_score = calculate_gaze_score(yaw, pitch, target=(0, 0))
    
    # Convert to 3D normalized gaze vector
    gaze_vector = [sin(yaw)*cos(pitch), -sin(pitch), cos(yaw)*cos(pitch)]
    gaze_vector = normalize(gaze_vector)
    
    return success, {yaw, pitch, gaze_score, vector}
```

**Output**: `(success: bool, {yaw: float, pitch: float, gaze_score: float, vector: np.array})`

**Gaze Score Calculation**:
- Target: (yaw=0°, pitch=0°) = looking straight ahead at screen
- Thresholds: yaw=30°, pitch=30°
- Score decreases as deviation from target increases

---

## Stage IV: Attention Index (Mathematical Fusion)

### Purpose
- **Single Metric**: Fuse Pose Score and Gaze Score into one attentiveness value
- **EMA Smoothing**: Prevent score flickering between frames

### Implementation Details

**File**: `score_calculator.py`

**Key Formula**:
```
Instantaneous Score: S(t) = w1 × Pose_Score + w2 × Gaze_Score
                      where w1 = 0.6, w2 = 0.4

EMA Smoothing: Final_Score_t = α × S(t) + (1-α) × Final_Score_{t-1}
               where α = 0.3
```

**Pseudo-code**:
```python
def calculate_attention_score(pose_result, gaze_result):
    # Extract scores
    pose_score = pose_result['pose_score']  # 0.0-1.0
    gaze_score = gaze_result['gaze_score']  # 0.0-1.0
    
    # Weighted sum: S(t) = w1 × Pose_Score + w2 × Gaze_Score
    w1 = 0.6  # Head pose weight
    w2 = 0.4  # Gaze weight
    instantaneous_score = w1 * pose_score + w2 * gaze_score
    
    # EMA smoothing: Final_Score_t = α × S(t) + (1-α) × Final_Score_{t-1}
    alpha = 0.3
    if smoothed_score is None:
        smoothed_score = instantaneous_score
    else:
        smoothed_score = alpha * instantaneous_score + (1 - alpha) * smoothed_score
    
    return instantaneous_score, smoothed_score
```

**Output**: `(instantaneous_score: float, smoothed_score: float)` both in range [0.0, 1.0]

---

## Complete Pipeline Flow

### Main Loop (`attention_monitor.py`)

```python
def process_frame(webcam_frame):
    # Stage I: Gatekeeper
    person_detected, cropped_frame, bbox = gatekeeper.process(webcam_frame)
    if not person_detected:
        return None  # Pause execution, save CPU
    
    # Stage II: Head Pose
    pose_success, pose_result = head_pose_estimator.process(cropped_frame)
    if not pose_success:
        pose_result = None
    
    # Stage III: Gaze Tracking
    gaze_success, gaze_result = gaze_tracker.process(cropped_frame)
    if not gaze_success:
        gaze_result = None
    
    # Stage IV: Score Calculation
    inst_score, smooth_score = score_calculator.calculate(
        head_pose_angles=pose_result,
        gaze_vector=gaze_result
    )
    
    return {
        'bbox': bbox,
        'pose': pose_result,
        'gaze': gaze_result,
        'scores': (inst_score, smooth_score)
    }
```

---

## File Structure

```
.
├── gatekeeper.py           # Stage I: YOLOv8 Nano person detection
├── head_pose.py            # Stage II: MediaPipe Face Mesh head pose
├── gaze_tracker.py         # Stage III: L2CS-Net ONNX gaze tracking
├── score_calculator.py     # Stage IV: Score fusion and EMA smoothing
├── attention_monitor.py    # Main pipeline integration
├── requirements.txt        # Dependencies
└── IMPLEMENTATION_PLAN.md  # This file
```

---

## Dependencies

```txt
opencv-python>=4.8.0        # Computer vision operations
ultralytics>=8.0.0          # YOLOv8 Nano
mediapipe>=0.10.0           # Face Mesh (468 landmarks)
onnxruntime>=1.15.0         # L2CS-Net ONNX inference
numpy>=1.24.0               # Numerical operations
Pillow>=10.0.0              # Image processing
```

---

## Model Files Required

1. **YOLOv8 Nano**: `yolov8n.pt` (auto-downloaded by Ultralytics)
2. **L2CS-Net ONNX**: `l2cs_net.onnx` (must be provided by user)

---

## Performance Characteristics

- **YOLOv8 Nano**: ~10-30ms per frame (CPU)
- **MediaPipe Face Mesh**: ~5-10ms per frame (CPU)
- **L2CS-Net ONNX**: ~20-50ms per frame (CPU)
- **Total Pipeline**: ~35-90ms per frame (~11-28 FPS)

---

## Key Design Decisions

1. **NO OpenCV Haar Cascades**: Removed fallback - MediaPipe is required
2. **NO Dlib**: Too heavy for CPU - using MediaPipe instead
3. **ONNX Runtime**: Faster than PyTorch for CPU inference
4. **Full Face Processing**: L2CS-Net processes entire cropped face, not just eyes
5. **Weighted Fusion**: w1=0.6 (pose), w2=0.4 (gaze) as specified
6. **EMA Smoothing**: α=0.3 prevents jittering

---

## Usage Example

```python
from attention_monitor import AttentionMonitor

monitor = AttentionMonitor(
    camera_id=0,
    yolo_model='yolov8n.pt',
    gaze_model_path='l2cs_net.onnx',
    head_pose_weight=0.6,  # w1
    gaze_weight=0.4,        # w2
    ema_alpha=0.3          # α
)

monitor.run()
```
