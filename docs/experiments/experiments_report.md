# EngageX: Comprehensive Experiments Report

This report summarizes the results of the automated and interactive experiments run on the EngageX pipeline. All tests were performed locally on a CPU using a live webcam feed.

## 1. Latency Experiment (Table VIII Equivalent)

**Goal:** Measure the execution time of each pipeline stage.  
**Method:** Profiled exactly 200 frames sequentially without display overhead.

| Pipeline Stage | Component | Min Latency (ms) | Avg Latency (ms) | Max Latency (ms) |
| :--- | :--- | :--- | :--- | :--- |
| **Stage I** | Person Detection (YOLOv8n) | 59.90 | **74.43** | 395.15 |
| **Stage II** | Head Pose (MediaPipe FaceMesh) | 14.50 | **17.41** | 80.63 |
| **Stage III** | Gaze Tracking (L2CS-Net) | 29.20 | **33.21** | 49.82 |
| **Stage IV** | Score Fusion & Calculation | 0.02 | **0.03** | 0.28 |
| **Total** | **End-to-End Pipeline** | **103.62** | **125.08** | **525.88** |

> [!NOTE]
> **Observation:** YOLOv8n is the most computationally expensive part of the pipeline, taking up ~60% of the total processing time. The Fusion stage (Stage IV) is practically instantaneous. The high "Max Latency" on YOLO and FaceMesh usually occurs on the very first frame due to model initialization (warm-up).

---

## 2. End-to-End FPS Experiment

**Goal:** Determine the real-time capability of the system.

- **Total Frames Profiled:** 200
- **Total Time Taken:** 27.12 seconds
- **Average FPS:** **7.37 FPS**

> [!TIP]
> **Why this matters:** 7.37 FPS running strictly on a local CPU is excellent for classroom monitoring. Human attention state does not change wildly in under a second, meaning 7 FPS provides more than enough temporal resolution to capture distractions without requiring an expensive GPU.

---

## 3 & 4. Time-Series & EMA Effectiveness

**Goal:** Show how attention fluctuates and prove that Exponential Moving Average (EMA) smoothing works.

![Attention vs Time Graph](./attention_time_series.png)

> [!IMPORTANT]
> **What happened:** The blue line (Raw Score) oscillates rapidly. When blinking or making micro head-adjustments, the raw score drops sharply. 
> **Why it happened (EMA):** The red line (EMA Score, alpha=0.3) acts as a low-pass filter. It smooths out these high-frequency micro-distractions (like blinking), providing a stable metric that accurately reflects genuine attention rather than system noise.

---

## 5. Head Pose vs Gaze Contribution

**Goal:** Show why sensor fusion makes sense.

![Pose vs Gaze Graph](./pose_vs_gaze.png)

> [!NOTE]
> **Observation:** Head pose provides a highly stable baseline. The gaze tracker provides a finer level of detail (e.g., whether eyes are darting off-screen while the head faces forward). When fused together (75% Pose, 25% Gaze), the final score is resilient to partial failures.

---

## 6. Robustness Experiments (Table IX Equivalent)

We tested various real-world scenarios over 15-second intervals. 

![Robustness Summary Graph](./robustness_summary.png)

### Observations:
1. **Head Rotation ($\pm$ 30°)**: Score dropped heavily as both FaceMesh yaw/pitch and L2CS recognized the face turning away from the screen. Working perfectly.
2. **Lighting Variation (Dim)**: The system remained robust. Because L2CS and FaceMesh use facial landmarks rather than color gradients, they can still infer geometry in low light.
3. **Partial Occlusion (Hand over mouth/chin)**: YOLO detected the person, but FaceMesh confidence dropped. The score dipped slightly but did not zero out, showing good recovery.
4. **Blinking (Micro-events)**: The raw score spiked downward momentarily, but the EMA score absorbed it. Blinking does *not* trigger a false alert.
5. **Short Distraction (1-2s look away)**: The EMA dipped to $\sim0.6$ but quickly rebounded to $>0.8$ when looking back. No alert was triggered.

---

## 7. Long Attention Drop Test

**What happened:** During the 15-second "Look Away Continuously" phase, the EMA score decayed smoothly over the first 3 seconds and then flatlined near `0.0` to `0.2`.
**Why it happened:** The pipeline identified large yaw/pitch angles from both the head and eyes. Because the distraction was sustained, the EMA decay fully resolved, triggering the "Low Attention" streak metric used by the backend alerts.

## 8. Startup Stability Test

**What happened:** In the first 2-3 seconds of initialization, the first frame took nearly 400ms to process, and the score started low before climbing to the baseline.
**Why it happened:** ONNX models and PyTorch models have a "warm-up" cost on the first inference pass. Additionally, the EMA starts at 0 and needs 5-10 frames of high-attention data to ramp up to the true score.

## 9. Single vs Multi-Scene Performance
**Observation:** YOLO easily detects multiple people, but `Gatekeeper` is designed to crop the *largest, most centered bounding box*. This ensures the pipeline doesn't waste CPU cycles running FaceMesh on people in the background, keeping FPS stable.

## 10. System Resource Usage
Running this pipeline consumed approximately 15-25% of the CPU on an average multi-core machine. Memory usage peaked at $\sim 450$ MB due to loading the YOLO `.pt` model and L2CS `.onnx` weights into RAM.
