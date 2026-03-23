# Real-Time Attention Monitoring System - Complete Project Explanation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture & Pipeline](#architecture--pipeline)
3. [Stage I: YOLOv8 Nano Gatekeeper](#stage-i-yolov8-nano-gatekeeper)
4. [Stage II: MediaPipe Face Mesh Head Pose](#stage-ii-mediapipe-face-mesh-head-pose)
5. [Stage III: L2CS-Net Gaze Tracking](#stage-iii-l2cs-net-gaze-tracking)
6. [Stage IV: Attention Score Calculation](#stage-iv-attention-score-calculation)
7. [Complete Data Flow](#complete-data-flow)
8. [Why These Models?](#why-these-models)
9. [Mathematical Formulas](#mathematical-formulas)
10. [Performance Characteristics](#performance-characteristics)

---

## 🎯 System Overview

### Purpose
This system monitors a user's attention in real-time by analyzing:
- **Head orientation** (where the head is pointing)
- **Eye gaze direction** (where the eyes are looking)

The goal is to determine if someone is paying attention to a screen (e.g., during online learning, meetings, or work) versus being distracted (looking away, at phone, etc.).

### Key Features
- ✅ **Real-time processing** (~11-28 FPS on CPU)
- ✅ **Lightweight** - runs entirely on CPU, no GPU required
- ✅ **Local execution** - all processing happens on-device, no cloud needed
- ✅ **Single metric output** - one attentiveness score (0.0 to 1.0)

---

## 🏗️ Architecture & Pipeline

The system uses a **4-stage linear pipeline** where each stage processes the output of the previous stage:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Webcam     │ --> │ Stage I:     │ --> │ Stage II:    │ --> │ Stage III:   │ --> │ Stage IV:   │
│  Feed       │     │ YOLOv8 Nano  │     │ MediaPipe    │     │ L2CS-Net     │     │ Score Calc  │
│             │     │ (Person Det) │     │ (Head Pose)  │     │ (Gaze Track) │     │ (Fusion)    │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
    640x480              ROI Crop           468 Landmarks        224x224 Face         0.0-1.0 Score
```

### Pipeline Flow
1. **Input**: Webcam captures frame (640×480 pixels)
2. **Stage I**: YOLOv8 detects person → crops face region
3. **Stage II**: MediaPipe extracts facial landmarks → calculates head angles
4. **Stage III**: L2CS-Net processes face → estimates gaze direction
5. **Stage IV**: Combines head pose + gaze → outputs attentiveness score

---

## 🔍 Stage I: YOLOv8 Nano Gatekeeper

### What It Does
- **Detects if a person is present** in the frame
- **Crops the person's bounding box** to focus on the face region
- **Saves CPU** by skipping processing when no person is detected

### Why YOLOv8 Nano?
1. **Lightweight**: Smallest YOLO variant (~6MB model size)
2. **Fast**: ~10-30ms inference on CPU
3. **Accurate**: State-of-the-art object detection
4. **Person-specific**: Trained on COCO dataset with 80 classes, including "person" (class ID 0)

### How It Works

#### Step 1: Person Detection
```python
# Load YOLOv8 Nano model
model = YOLO('yolov8n.pt')

# Run inference on frame
results = model(frame)

# Filter for Person class (ID = 0)
for detection in results:
    if detection.class_id == 0 and detection.confidence >= 0.5:
        bbox = detection.bbox  # [x1, y1, x2, y2]
```

**Output**: Bounding box coordinates `[x1, y1, x2, y2]` if person detected, `None` otherwise

#### Step 2: ROI Cropping
```python
# Add padding around bounding box
x1 = max(0, bbox_x1 - 20)
y1 = max(0, bbox_y1 - 20)
x2 = min(frame_width, bbox_x2 + 20)
y2 = min(frame_height, bbox_y2 + 20)

# Crop the region
cropped_face = frame[y1:y2, x1:x2]
```

**Why Crop?**
- **Higher resolution** for face processing (more pixels = better accuracy)
- **Faster processing** (smaller image = less computation)
- **Removes background noise** (focuses only on the person)

### Technical Details
- **Model**: YOLOv8 Nano (`yolov8n.pt`)
- **Input**: Full frame (640×480)
- **Output**: Cropped face region (variable size, typically 200×300 pixels)
- **Processing Time**: ~10-30ms per frame
- **Confidence Threshold**: 0.5 (50% confidence required)

---

## 📐 Stage II: MediaPipe Face Mesh Head Pose

### What It Does
- **Detects 468 facial landmarks** (nose, eyes, mouth, face contour, etc.)
- **Calculates head orientation** (yaw, pitch, roll angles)
- **Determines if head is facing forward** or turned away

### Why MediaPipe Face Mesh?
1. **468 Landmarks**: Extremely detailed facial structure
2. **Fast**: ~5-10ms inference on CPU (optimized C++ backend)
3. **Accurate**: Google's production-grade face detection
4. **No training needed**: Pre-trained model works out of the box
5. **Lightweight**: Small model size, efficient inference

### How It Works

#### Step 1: Facial Landmark Detection
```python
# Initialize MediaPipe Face Mesh
face_mesh = mp.solutions.face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True  # Use 468 landmarks (not 468)
)

# Process frame
results = face_mesh.process(rgb_frame)

# Extract 6 key landmarks for head pose:
# - Nose tip (landmark 1)
# - Chin (landmark 175)
# - Left eye corner (landmark 33)
# - Right eye corner (landmark 263)
# - Left mouth corner (landmark 61)
# - Right mouth corner (landmark 291)
```

**Why 6 Landmarks?**
These specific points are stable and well-distributed across the face, perfect for calculating 3D head orientation.

#### Step 2: Perspective-n-Point (PnP) Algorithm

**What is PnP?**
PnP solves: "Given 2D image points and their corresponding 3D model points, what is the camera's view angle?"

```python
# Standard 3D face model (in millimeters)
face_3d_model = [
    [0.0, 0.0, 0.0],           # Nose tip
    [0.0, -330.0, -65.0],      # Chin
    [-225.0, 170.0, -135.0],   # Left eye
    [225.0, 170.0, -135.0],    # Right eye
    [-150.0, -150.0, -125.0],  # Left mouth
    [150.0, -150.0, -125.0]    # Right mouth
]

# Scale model to match image size (using inter-eye distance)
eye_distance_2d = distance(landmark_33, landmark_263)
scale_factor = eye_distance_2d / 450.0  # 450mm = typical inter-eye distance
face_3d_scaled = face_3d_model * scale_factor

# Solve PnP
rotation_vector, translation_vector = cv2.solvePnP(
    face_3d_scaled,      # 3D model points
    landmarks_2d,        # 2D image points
    camera_matrix,       # Camera intrinsics
    dist_coeffs          # Distortion coefficients
)
```

#### Step 3: Extract Euler Angles
```python
# Convert rotation vector to rotation matrix
rotation_matrix = cv2.Rodrigues(rotation_vector)

# Extract yaw, pitch, roll angles
yaw = arctan2(rotation_matrix[1,0], rotation_matrix[0,0])    # Left/Right turn
pitch = arctan2(-rotation_matrix[2,0], sy)                   # Up/Down tilt
roll = arctan2(rotation_matrix[2,1], rotation_matrix[2,2])   # Head tilt
```

**What Do These Angles Mean?**
- **Yaw**: Head turning left (-) or right (+). 0° = facing forward
- **Pitch**: Head tilting up (-) or down (+). 0° = level
- **Roll**: Head tilting left (-) or right (+). 0° = upright

#### Step 4: Calculate Pose Score
```python
# Normalize angles to 0.0-1.0 score
yaw_score = max(0, 1.0 - (abs(yaw) / 30.0))      # 30° threshold
pitch_score = max(0, 1.0 - (abs(pitch) / 30.0))  # 30° threshold
roll_score = max(0, 1.0 - (abs(roll) / 15.0))    # 15° threshold

# Weighted combination
pose_score = 0.4 * yaw_score + 0.4 * pitch_score + 0.2 * roll_score
```

**Interpretation**:
- `pose_score = 1.0`: Head perfectly facing forward
- `pose_score = 0.5`: Head turned ~15° away
- `pose_score = 0.0`: Head turned >30° away

### Technical Details
- **Model**: MediaPipe Face Mesh (468 landmarks)
- **Input**: Cropped face region from Stage I
- **Output**: `{yaw, pitch, roll, pose_score}`
- **Processing Time**: ~5-10ms per frame
- **Key Landmarks**: 6 points (nose, chin, eyes, mouth corners)

---

## 👁️ Stage III: L2CS-Net Gaze Tracking

### What It Does
- **Estimates where the eyes are looking** (gaze direction)
- **Distinguishes** between looking at screen vs. looking down at phone
- **Provides fine-grained attention** beyond just head orientation

### Why L2CS-Net?
1. **Calibration-free**: Works without user-specific calibration
2. **ONNX format**: Fast CPU inference (~20-50ms)
3. **Full face input**: Processes entire face (not just eyes) for context
4. **Robust**: Handles various lighting and head poses
5. **Lightweight**: Optimized for edge devices

### How It Works

#### Step 1: Preprocessing
```python
# Resize cropped face to 224×224 (model input size)
resized = cv2.resize(face_frame, (224, 224))

# Convert BGR to RGB
rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

# Normalize: [0, 255] -> [0, 1] then ImageNet normalization
normalized = (rgb / 255.0 - mean) / std
# mean = [0.485, 0.456, 0.406]
# std = [0.229, 0.224, 0.225]

# Convert to tensor format: [1, 3, 224, 224]
input_tensor = transpose(normalized, CHW)
```

**Why 224×224?**
- Standard input size for many CNN models
- Balances accuracy vs. speed
- Sufficient resolution for gaze estimation

#### Step 2: ONNX Inference
```python
# Load ONNX model
session = ort.InferenceSession('l2cs_net.onnx', providers=['CPU'])

# Run inference
outputs = session.run(None, {input_name: input_tensor})
yaw_logits, pitch_logits = outputs[0], outputs[1]
```

**What are Logits?**
L2CS-Net uses **classification** (not regression) for gaze angles:
- Divides gaze space into 28 bins (buckets)
- Each bin represents a range: -90° to +90° (yaw and pitch)
- Model outputs probability distribution over bins
- We select the bin with highest probability

#### Step 3: Convert to Angles
```python
# Get bin indices with maximum probability
yaw_idx = argmax(yaw_logits)      # Which bin for yaw?
pitch_idx = argmax(pitch_logits)  # Which bin for pitch?

# Convert bin index to angle
yaw_bins = linspace(-90, 90, 28)   # [-90, -85.7, ..., 85.7, 90]
pitch_bins = linspace(-90, 90, 28)

yaw = yaw_bins[yaw_idx]      # e.g., -15.5°
pitch = pitch_bins[pitch_idx]  # e.g., 10.2°
```

#### Step 4: Calculate Gaze Score
```python
# Calculate deviation from target (0°, 0° = looking straight ahead)
yaw_deviation = abs(yaw - 0.0)
pitch_deviation = abs(pitch - 0.0)

# Normalize to 0.0-1.0 score
yaw_score = max(0.0, 1.0 - (yaw_deviation / 30.0))
pitch_score = max(0.0, 1.0 - (pitch_deviation / 30.0))

gaze_score = 0.5 * yaw_score + 0.5 * pitch_score
```

#### Step 5: Create 3D Gaze Vector
```python
# Convert angles to 3D normalized vector
yaw_rad = radians(yaw)
pitch_rad = radians(pitch)

gaze_vector = [
    sin(yaw_rad) * cos(pitch_rad),  # x: right (+), left (-)
    -sin(pitch_rad),                 # y: up (-), down (+)
    cos(yaw_rad) * cos(pitch_rad)   # z: forward (+)
]

# Normalize to unit vector
gaze_vector = gaze_vector / norm(gaze_vector)
```

**Why 3D Vector?**
- Represents gaze direction in 3D space
- Can be used for advanced applications (e.g., screen point estimation)
- Standard format for gaze tracking systems

### Technical Details
- **Model**: L2CS-Net ONNX (28 bins for yaw, 28 bins for pitch)
- **Input**: Cropped face resized to 224×224
- **Output**: `{yaw, pitch, gaze_score, vector}`
- **Processing Time**: ~20-50ms per frame (CPU)
- **Angle Range**: -90° to +90° for both yaw and pitch

---

## 🧮 Stage IV: Attention Score Calculation

### What It Does
- **Combines** head pose score and gaze score into one metric
- **Smooths** the score over time to prevent flickering
- **Outputs** a single attentiveness value (0.0 to 1.0)

### Why This Approach?
1. **Weighted fusion**: Head pose (60%) + Gaze (40%) balances coarse and fine attention
2. **EMA smoothing**: Prevents score from jumping wildly between frames
3. **Single metric**: Easy to interpret and use in applications

### How It Works

#### Step 1: Instantaneous Score Calculation
```python
# Formula: S(t) = w1 × Pose_Score + w2 × Gaze_Score
# Where: w1 = 0.6, w2 = 0.4

instantaneous_score = 0.6 * pose_score + 0.4 * gaze_score
```

**Why These Weights?**
- **w1 = 0.6 (Head Pose)**: More weight because head orientation is a strong indicator
- **w2 = 0.4 (Gaze)**: Less weight but still important for fine-grained detection

**Example**:
- If `pose_score = 0.8` and `gaze_score = 0.9`:
  - `S(t) = 0.6 × 0.8 + 0.4 × 0.9 = 0.48 + 0.36 = 0.84` (very attentive)

- If `pose_score = 0.3` and `gaze_score = 0.2`:
  - `S(t) = 0.6 × 0.3 + 0.4 × 0.2 = 0.18 + 0.08 = 0.26` (distracted)

#### Step 2: EMA Smoothing
```python
# Formula: Final_Score_t = α × S(t) + (1-α) × Final_Score_{t-1}
# Where: α = 0.3

if smoothed_score is None:
    smoothed_score = instantaneous_score  # First frame
else:
    smoothed_score = 0.3 * instantaneous_score + 0.7 * smoothed_score
```

**What is EMA?**
Exponential Moving Average gives more weight to recent values while still considering history.

**Why α = 0.3?**
- **Lower α (0.1-0.2)**: More smoothing, slower response to changes
- **Higher α (0.4-0.5)**: Less smoothing, faster response but more jittery
- **α = 0.3**: Balanced - smooth enough to prevent flickering, responsive enough to detect changes

**Example**:
- Frame 1: `S(1) = 0.8` → `Final_Score_1 = 0.8`
- Frame 2: `S(2) = 0.6` → `Final_Score_2 = 0.3 × 0.6 + 0.7 × 0.8 = 0.74`
- Frame 3: `S(3) = 0.7` → `Final_Score_3 = 0.3 × 0.7 + 0.7 × 0.74 = 0.728`

### Score Interpretation

| Score Range | Interpretation | Meaning |
|------------|----------------|---------|
| **0.8 - 1.0** | Highly Attentive | Head facing forward, eyes on screen |
| **0.5 - 0.8** | Moderately Attentive | Slight deviation, still engaged |
| **0.0 - 0.5** | Distracted | Head turned away, looking elsewhere |

### Technical Details
- **Weights**: w1 = 0.6 (head pose), w2 = 0.4 (gaze)
- **EMA Alpha**: α = 0.3
- **Output Range**: 0.0 to 1.0
- **Processing Time**: <1ms (just math operations)

---

## 🔄 Complete Data Flow

### Frame-by-Frame Processing

```
┌─────────────────────────────────────────────────────────────────┐
│ FRAME 1: Webcam captures 640×480 BGR image                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE I: YOLOv8 Nano                                            │
│ - Input: 640×480 frame                                          │
│ - Process: Detect person (class ID 0)                           │
│ - Output: Bounding box [x1=100, y1=50, x2=300, y2=350]          │
│ - Crop: Extract region [100:350, 50:300] = 250×200 face         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE II: MediaPipe Face Mesh                                   │
│ - Input: 250×200 cropped face                                   │
│ - Process: Detect 468 landmarks, extract 6 key points           │
│ - PnP: Calculate head rotation                                  │
│ - Output: {yaw=-5.2°, pitch=2.1°, roll=0.3°, pose_score=0.92}   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE III: L2CS-Net ONNX                                        │
│ - Input: 250×200 cropped face                                   │
│ - Preprocess: Resize to 224×224, normalize                      │
│ - Inference: Run ONNX model                                     │
│ - Output: {yaw=-3.1°, pitch=1.5°, gaze_score=0.95, vector=[...]}│
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE IV: Score Calculation                                     │
│ - Input: pose_score=0.92, gaze_score=0.95                       │
│ - Calculate: S(t) = 0.6×0.92 + 0.4×0.95 = 0.932                 │
│ - Smooth: Final_Score = 0.3×0.932 + 0.7×0.900 = 0.910           │
│ - Output: Attentiveness = 0.91 (91% attentive)                  │
└─────────────────────────────────────────────────────────────────┘
```

### What Happens When No Person is Detected?

```
┌─────────────────────────────────────────────────────────────────┐
│ FRAME: Webcam captures frame                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE I: YOLOv8 Nano                                            │
│ - Process: No person detected (Person_Count = 0)               │
│ - Action: RETURN EARLY (skip Stages II, III, IV)               │
│ - CPU Saved: ~35-90ms per frame                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤔 Why These Models?

### Design Constraints
1. **Lightweight**: Must run on CPU only (no GPU)
2. **Real-time**: Need >10 FPS for smooth experience
3. **Accurate**: Must distinguish attention vs. distraction
4. **Local**: No cloud dependencies (privacy, latency)

### Model Selection Rationale

#### ✅ YOLOv8 Nano (vs. Alternatives)
| Alternative | Why Not Used |
|------------|--------------|
| YOLOv8 Small/Medium | Too slow for CPU (~50-100ms) |
| SSD MobileNet | Less accurate, similar speed |
| Haar Cascades | Too inaccurate, many false positives |
| MediaPipe Face Detection | Only detects face, not full person |

**Why YOLOv8 Nano Wins**:
- Fastest YOLO variant (~10-30ms)
- Still very accurate (state-of-the-art)
- Person detection (not just face)

#### ✅ MediaPipe Face Mesh (vs. Alternatives)
| Alternative | Why Not Used |
|------------|--------------|
| Dlib 68-point | Too heavy (~50-100ms), requires shape predictor file |
| OpenCV Haar Cascades | Too inaccurate, no 3D pose estimation |
| Deep Learning models | Too slow for real-time CPU inference |
| MediaPipe Tasks API | Newer API, but solutions module is simpler |

**Why MediaPipe Face Mesh Wins**:
- 468 landmarks (more detail than Dlib's 68)
- Extremely fast (~5-10ms)
- Built-in face detection + landmarks
- No external files needed

#### ✅ L2CS-Net ONNX (vs. Alternatives)
| Alternative | Why Not Used |
|------------|--------------|
| PyTorch L2CS-Net | Slower inference (~50-100ms) |
| GazeML | Requires calibration, heavier model |
| iTracker | Too slow, requires eye region detection |
| Simple geometric methods | Not accurate enough |

**Why L2CS-Net ONNX Wins**:
- Calibration-free (works immediately)
- ONNX Runtime is optimized for CPU
- Processes full face (more context)
- Good accuracy-speed tradeoff

---

## 📊 Mathematical Formulas

### 1. Head Pose Score
```
yaw_score = max(0, 1.0 - |yaw| / 30.0)
pitch_score = max(0, 1.0 - |pitch| / 30.0)
roll_score = max(0, 1.0 - |roll| / 15.0)

pose_score = 0.4 × yaw_score + 0.4 × pitch_score + 0.2 × roll_score
```

### 2. Gaze Score
```
yaw_deviation = |gaze_yaw - target_yaw|
pitch_deviation = |gaze_pitch - target_pitch|

yaw_score = max(0, 1.0 - yaw_deviation / 30.0)
pitch_score = max(0, 1.0 - pitch_deviation / 30.0)

gaze_score = 0.5 × yaw_score + 0.5 × pitch_score
```

### 3. Instantaneous Attention Score
```
S(t) = w1 × pose_score + w2 × gaze_score
     = 0.6 × pose_score + 0.4 × gaze_score
```

### 4. EMA Smoothing
```
Final_Score_t = α × S(t) + (1-α) × Final_Score_{t-1}
              = 0.3 × S(t) + 0.7 × Final_Score_{t-1}
```

Where:
- `S(t)`: Instantaneous score at frame t
- `Final_Score_t`: Smoothed score at frame t
- `Final_Score_{t-1}`: Previous smoothed score
- `α = 0.3`: Smoothing factor

---

## ⚡ Performance Characteristics

### Processing Times (CPU, Intel i5-8th Gen)

| Stage | Model | Time per Frame | Notes |
|-------|-------|----------------|-------|
| **Stage I** | YOLOv8 Nano | 10-30ms | Depends on frame size |
| **Stage II** | MediaPipe Face Mesh | 5-10ms | Very fast, optimized C++ |
| **Stage III** | L2CS-Net ONNX | 20-50ms | ONNX Runtime CPU inference |
| **Stage IV** | Score Calculation | <1ms | Just math operations |
| **Total** | Full Pipeline | **35-90ms** | **~11-28 FPS** |

### Memory Usage
- **YOLOv8 Nano**: ~50MB RAM
- **MediaPipe**: ~30MB RAM
- **L2CS-Net ONNX**: ~100MB RAM
- **Total**: ~180MB RAM

### Model Sizes
- **YOLOv8 Nano**: ~6MB (`yolov8n.pt`)
- **MediaPipe**: Built-in (no separate file)
- **L2CS-Net ONNX**: ~10-50MB (`l2cs_net.onnx`)

---

## 🎓 Key Concepts Explained

### What is ROI Cropping?
**ROI = Region of Interest**

Instead of processing the entire 640×480 frame, we:
1. Detect where the person is
2. Crop just that region (e.g., 200×300 pixels)
3. Process the smaller image

**Benefits**:
- Higher effective resolution for face
- Faster processing (fewer pixels)
- Removes irrelevant background

### What is PnP (Perspective-n-Point)?
A computer vision algorithm that:
- Takes 2D image points (where landmarks appear in photo)
- Takes 3D model points (where landmarks are in real 3D space)
- Calculates the camera's viewing angle

**Analogy**: If you know where someone's nose, eyes, and mouth are in a photo, and you know their real 3D positions, you can figure out which way their head is turned.

### What is EMA Smoothing?
**EMA = Exponential Moving Average**

Instead of using the raw score each frame, we:
- Take 30% of the new score
- Take 70% of the previous smoothed score
- Combine them

**Why?** Prevents the score from jumping wildly. If someone briefly looks away, the score decreases gradually rather than instantly.

**Example**:
- Without smoothing: `0.9 → 0.3 → 0.8 → 0.4` (jittery)
- With smoothing: `0.9 → 0.78 → 0.79 → 0.68` (smooth)

### What are Euler Angles?
Three angles that describe 3D rotation:
- **Yaw**: Rotation around vertical axis (left/right turn)
- **Pitch**: Rotation around horizontal axis (up/down tilt)
- **Roll**: Rotation around forward axis (head tilt)

**Analogy**: Like describing how a plane is oriented:
- Yaw = which direction the plane is pointing
- Pitch = nose up or down
- Roll = wings tilted left or right

---

## 🔧 Technical Implementation Details

### Coordinate Systems

#### Camera Coordinates (Right-Handed)
- **X-axis**: Right (+) / Left (-)
- **Y-axis**: Down (+) / Up (-)
- **Z-axis**: Forward (+) / Backward (-)

#### Gaze Vector
- `[0, 0, 1]` = Looking straight ahead (forward)
- `[1, 0, 0]` = Looking right
- `[0, -1, 0]` = Looking up
- `[0, 1, 0]` = Looking down

### Image Formats

#### BGR vs RGB
- **OpenCV uses BGR**: Blue-Green-Red channel order
- **MediaPipe uses RGB**: Red-Green-Blue channel order
- **Conversion**: `rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)`

#### Normalization
- **Raw pixel values**: 0-255 (uint8)
- **Normalized**: 0.0-1.0 (float32)
- **ImageNet normalization**: `(pixel/255.0 - mean) / std`

### Model Input/Output Formats

#### YOLOv8 Output
```python
results = model(frame)
box = results.boxes[0]
x1, y1, x2, y2 = box.xyxy[0]  # Bounding box coordinates
confidence = box.conf          # Detection confidence
class_id = box.cls             # Class ID (0 = person)
```

#### MediaPipe Output
```python
results = face_mesh.process(rgb_frame)
landmarks = results.multi_face_landmarks[0]
landmark = landmarks.landmark[1]  # Nose tip
x = landmark.x * image_width      # Normalized to pixel
y = landmark.y * image_height
```

#### L2CS-Net Output
```python
outputs = session.run(None, {input_name: tensor})
yaw_logits = outputs[0]    # Shape: [1, 28]
pitch_logits = outputs[1] # Shape: [1, 28]
yaw_idx = argmax(yaw_logits[0])
yaw = yaw_bins[yaw_idx]
```

---

## 📈 Use Cases & Applications

### 1. Online Learning
- Monitor student attention during virtual classes
- Alert when attention drops below threshold
- Generate attention reports for teachers

### 2. Remote Work
- Track focus during video meetings
- Productivity monitoring
- Break reminders when attention wanes

### 3. Driver Monitoring
- Detect distracted driving
- Alert when driver looks away from road
- Integration with ADAS systems

### 4. Research & Analytics
- Attention span studies
- UI/UX testing (where users look)
- Behavioral analysis

---

## 🚀 Future Enhancements

### Possible Improvements
1. **Multi-face support**: Track multiple people simultaneously
2. **Emotion detection**: Add facial expression analysis
3. **Screen point estimation**: Calculate where on screen user is looking
4. **Calibration routine**: Improve gaze accuracy with user-specific calibration
5. **GPU acceleration**: Use CUDA for faster processing
6. **Video file input**: Process recorded videos, not just webcam
7. **Export logs**: Save attention scores to CSV/database

---

## 📚 Summary

This system combines **three specialized models** in a **4-stage pipeline** to monitor attention in real-time:

1. **YOLOv8 Nano**: Fast person detection → crops face region
2. **MediaPipe Face Mesh**: 468 landmarks → head pose angles
3. **L2CS-Net ONNX**: Full face processing → gaze direction
4. **Score Calculator**: Weighted fusion + EMA smoothing → single metric

**Key Design Principles**:
- ✅ Lightweight (CPU-only)
- ✅ Real-time (>10 FPS)
- ✅ Accurate (state-of-the-art models)
- ✅ Local (no cloud)

**Output**: A single attentiveness score (0.0-1.0) that indicates how focused the user is, updated in real-time at ~11-28 FPS.

---

*This document provides a comprehensive explanation of the Real-Time Attention Monitoring System. For implementation details, see the code files and `IMPLEMENTATION_PLAN.md`.*
