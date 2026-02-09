# Real-Time Attention Monitoring System (CPU-First)

This repository contains a lightweight, local-execution blueprint and starter implementation for a **real-time attentiveness monitor** using:

- **YOLOv8 Nano** for person detection and ROI cropping.
- **MediaPipe Face Mesh** + `solvePnP` for head-pose (yaw/pitch/roll).
- **L2CS-Net (or compatible gaze model)** for gaze vectors.
- **Weighted score + EMA smoothing** for a stable attentiveness signal.

## Pipeline

`Webcam Frame -> YOLO Gatekeeper -> ROI Crop -> Face Mesh + PnP -> Gaze Estimation -> Weighted Score -> EMA`

## Design Goals

- CPU-friendly and local only.
- Real-time frame-by-frame processing.
- Minimal model footprint.
- Graceful degradation if gaze model is unavailable.

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python attention_monitor.py --camera 0
```

## Notes

- If no person is detected, heavy stages are skipped to save CPU.
- Emotion is intentionally excluded from scoring for lightweight execution.
- Gaze integration is prepared with a pluggable interface (`GazeEstimator`).
