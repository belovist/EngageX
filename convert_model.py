"""
EngageX - L2CS ONNX Conversion Script
Run from the root of the EngageX repo.
Requirements: torch, torchvision, onnx

Steps:
1. Download L2CSNet_gaze360.pkl and place it in models/
2. Run: python convert_model.py
3. Output: models/l2cs_net.onnx (~91MB)
"""

import torch
import torchvision
import importlib.util
import onnx
import onnx.numpy_helper
import io
import os

PKL_PATH = "models/L2CSNet_gaze360.pkl"
ONNX_PATH = "models/l2cs_net.onnx"
MODEL_PY  = "L2CS-Net/l2cs/model.py"

# Check pkl exists
if not os.path.exists(PKL_PATH):
    print(f"❌ Model not found at {PKL_PATH}")
    print("Download L2CSNet_gaze360.pkl and place it in the models/ folder.")
    exit(1)

# Load L2CS model class directly (bypasses broken __init__.py)
spec = importlib.util.spec_from_file_location("model", MODEL_PY)
model_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model_module)
L2CS = model_module.L2CS

# Build model and load weights
model = L2CS(torchvision.models.resnet.Bottleneck, [3, 4, 6, 3], 90)
checkpoint = torch.load(PKL_PATH, map_location="cpu")
model.load_state_dict(checkpoint, strict=False)
model.eval()
print(f"✅ Loaded model with {sum(p.numel() for p in model.parameters()):,} params")

# Export to ONNX buffer
dummy = torch.randn(1, 3, 224, 224)
buf = io.BytesIO()
with torch.no_grad():
    torch.onnx.export(
        model, dummy, buf,
        opset_version=16,
        input_names=["input"],
        output_names=["yaw", "pitch"],
        dynamo=False
    )

# Inject trained weights into initializers
buf.seek(0)
onnx_model = onnx.load(buf)
onnx_model.graph.ClearField("initializer")
for name, param in model.named_parameters():
    tensor = onnx.numpy_helper.from_array(param.detach().numpy(), name=name)
    onnx_model.graph.initializer.append(tensor)

onnx.save(onnx_model, ONNX_PATH)
size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
print(f"✅ Saved to {ONNX_PATH} ({size_mb:.1f} MB)")
