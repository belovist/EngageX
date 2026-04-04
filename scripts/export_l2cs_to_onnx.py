"""
One-time script to export the L2CS-Net PyTorch model to ONNX for use in gaze_tracker.py.

Usage (from the project root):

1. Install dependencies in your environment (inside your virtualenv, e.g. mp_env):
   - pip install torch torchvision

2. Download the pretrained L2CS-Net weights:
   - From the L2CS-Net README link, download `L2CSNet_gaze360.pkl`
   - Place it at: L2CS-Net/models/L2CSNet_gaze360.pkl

3. Run this script:
   - python export_l2cs_to_onnx.py

4. This will create: l2cs_net.onnx in the project root.
   - After that, gaze_tracker.py will automatically pick it up.
"""

import os
from pathlib import Path
import importlib.util

import torch
import torchvision


def main():
    project_root = Path(__file__).resolve().parent

    # Path to L2CS-Net repo and weights
    l2cs_repo = project_root / "L2CS-Net"
    weights_path = l2cs_repo / "models" / "L2CSNet_gaze360.pkl"

    if not l2cs_repo.exists():
        raise FileNotFoundError(
            f"L2CS-Net repo not found at {l2cs_repo}. "
            "Make sure the L2CS-Net folder is cloned into the project root."
        )

    if not weights_path.exists():
        raise FileNotFoundError(
            f"Pretrained weights not found at {weights_path}.\n"
            "Download `L2CSNet_gaze360.pkl` from the L2CS-Net README link and "
            "place it in the `L2CS-Net/models/` directory."
        )

    # Load L2CS class directly from model.py (no package/RetinaFace needed)
    model_path = l2cs_repo / "l2cs" / "model.py"
    if not model_path.exists():
        raise FileNotFoundError(f"Could not find model.py at {model_path}")

    spec = importlib.util.spec_from_file_location("l2cs_model", model_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Failed to create import spec for {model_path}")

    l2cs_model = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(l2cs_model)  # type: ignore[attr-defined]

    if not hasattr(l2cs_model, "L2CS"):
        raise AttributeError("model.py does not define L2CS class")

    L2CS = l2cs_model.L2CS  # type: ignore[attr-defined]

    # Recreate getArch('ResNet50', 90) logic from utils.getArch
    num_bins = 90
    arch = "ResNet50"

    print(f"Building L2CS-Net architecture '{arch}' with {num_bins} bins...")
    model = L2CS(
        torchvision.models.resnet.Bottleneck,
        [3, 4, 6, 3],  # ResNet50 layers
        num_bins,
    )

    print(f"Loading pretrained weights from {weights_path}...")
    state_dict = torch.load(weights_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    # Dummy input: 1 x 3 x 224 x 224 (same as gaze_tracker.py expects)
    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    onnx_path = project_root / "l2cs_net.onnx"
    print(f"Exporting model to ONNX at {onnx_path}...")

    torch.onnx.export(
        model,
        dummy_input,
        str(onnx_path),
        input_names=["input"],
        output_names=["yaw_logits", "pitch_logits"],
        opset_version=11,
        do_constant_folding=True,
        dynamic_axes={
            "input": {0: "batch_size"},
            "yaw_logits": {0: "batch_size"},
            "pitch_logits": {0: "batch_size"},
        },
    )

    print("ONNX export complete.")
    print(f"Saved L2CS-Net ONNX model to: {onnx_path}")
    print("You can now run attention_monitor.py and the gaze tracker will use this model.")


if __name__ == "__main__":
    main()

