"""
EngageX Model Setup Script
Run this once before starting the app: python setup_models.py
"""

import os
import sys
import urllib.request

MODELS_DIR = "models"
PKL_PATH = os.path.join(MODELS_DIR, "L2CSNet_gaze360.pkl")
ONNX_PATH = os.path.join(MODELS_DIR, "l2cs_net.onnx")
GDRIVE_PKL_URL = "https://drive.google.com/uc?export=download&id=18S956r4jnHtSeT8z8t3z8AoJZjVnNqPJ"

def download_file(url, dest):
    print(f"Downloading {dest}...")
    def progress(count, block_size, total_size):
        if total_size > 0:
            percent = min(int(count * block_size * 100 / total_size), 100)
            print(f"\r  {percent}%", end="", flush=True)
    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print(f"\n✅ Downloaded {dest}")

def convert_to_onnx():
    print("Converting .pkl to ONNX (this may take a minute)...")
    try:
        import torch
        import torchvision
        import importlib.util
        import onnx
        import onnx.numpy_helper
        import io
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Run: pip install torch torchvision onnx")
        sys.exit(1)

    MODEL_PY = "L2CS-Net/l2cs/model.py"
    if not os.path.exists(MODEL_PY):
        print(f"❌ {MODEL_PY} not found.")
        print("Run: git submodule update --init --recursive")
        sys.exit(1)

    spec = importlib.util.spec_from_file_location("model", MODEL_PY)
    model_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(model_module)
    L2CS = model_module.L2CS

    model = L2CS(torchvision.models.resnet.Bottleneck, [3, 4, 6, 3], 90)
    checkpoint = torch.load(PKL_PATH, map_location="cpu")
    model.load_state_dict(checkpoint, strict=False)
    model.eval()
    print(f"  Loaded {sum(p.numel() for p in model.parameters()):,} params")

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

    buf.seek(0)
    onnx_model = onnx.load(buf)
    onnx_model.graph.ClearField("initializer")
    for name, param in model.named_parameters():
        tensor = onnx.numpy_helper.from_array(param.detach().numpy(), name=name)
        onnx_model.graph.initializer.append(tensor)

    onnx.save(onnx_model, ONNX_PATH)
    size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
    print(f"✅ Saved {ONNX_PATH} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Already done
    if os.path.exists(ONNX_PATH):
        size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
        if size_mb > 50:
            print(f"✅ {ONNX_PATH} already exists ({size_mb:.1f} MB), skipping setup.")
            sys.exit(0)
        else:
            print(f"⚠️  {ONNX_PATH} exists but is too small ({size_mb:.1f} MB), re-converting...")
            os.remove(ONNX_PATH)

    # Download pkl if needed
    if not os.path.exists(PKL_PATH):
        print("Model not found locally, downloading from Google Drive...")
        try:
            download_file(GDRIVE_PKL_URL, PKL_PATH)
        except Exception as e:
            print(f"❌ Download failed: {e}")
            print(f"Please manually download L2CSNet_gaze360.pkl and place it in {MODELS_DIR}/")
            sys.exit(1)
    else:
        print(f"✅ {PKL_PATH} already exists, skipping download.")

    # Convert to ONNX
    convert_to_onnx()
    print("\n✅ Setup complete! You can now run: ./start.sh")