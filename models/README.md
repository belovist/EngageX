# Model Files

This directory contains ML model files required for the attention monitoring pipeline.

## Required Models

### 1. YOLOv8 Nano (`yolov8n.pt`)
- **Purpose**: Person detection (Stage I - Gatekeeper)
- **Download**: Auto-downloaded by Ultralytics on first run
- **Size**: ~6 MB

### 2. L2CS-Net ONNX (`l2cs_net.onnx`)
- **Purpose**: Gaze estimation (Stage III)
- **Download**: Must be manually exported from L2CS-Net PyTorch model
- **Size**: ~90 MB

## Setup Instructions

### Option A: Auto-setup (Recommended)
YOLOv8 will auto-download on first run. For gaze tracking:

1. Clone L2CS-Net repository to project root:
   ```bash
   git clone https://github.com/Ahmednull/L2CS-Net.git
   ```

2. Download pretrained weights (`L2CSNet_gaze360.pkl`) from L2CS-Net releases
   and place in `L2CS-Net/models/`

3. Run the export script:
   ```bash
   python scripts/export_l2cs_to_onnx.py
   ```

4. The script exports directly to `models/l2cs_net.onnx`

### Option B: Head-pose only mode
If gaze model is unavailable, the system falls back to head-pose-only scoring.
No additional setup required.

## Notes
- `L2CS-Net/` is an external optional repository and is ignored by git in this project
- Model files are excluded from git via `.gitignore`
- The system gracefully degrades if models are missing
