"""
EngageX Model Setup Script
Run once before starting: python setup_models.py
"""

import os
import sys
import subprocess

MODELS_DIR = "models"
ONNX_PATH = os.path.join(MODELS_DIR, "l2cs_net.onnx")
FILE_ID = "1RpaB-LQtHzsZOih-lHrr0Mdjnx8TVLIH"

def install_gdown():
    print("Installing gdown...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown", "-q"])

def download_with_gdown():
    import gdown
    print("Downloading ONNX model from Google Drive...")
    url = f"https://drive.google.com/uc?id={FILE_ID}"
    gdown.download(url, ONNX_PATH, quiet=False, fuzzy=True)

if __name__ == "__main__":
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Check if already exists
    if os.path.exists(ONNX_PATH):
        size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
        if size_mb > 50:
            print(f"✅ Model already exists ({size_mb:.1f} MB), skipping.")
            sys.exit(0)
        else:
            print(f"⚠️  Model too small ({size_mb:.1f} MB), re-downloading...")
            os.remove(ONNX_PATH)

    # Install gdown if needed
    try:
        import gdown
    except ImportError:
        install_gdown()
        import gdown

    # Download
    try:
        download_with_gdown()
        size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
        if size_mb < 50:
            print(f"❌ Download incomplete ({size_mb:.1f} MB). Try manually downloading.")
            os.remove(ONNX_PATH)
            sys.exit(1)
        print(f"✅ Model ready ({size_mb:.1f} MB)")
        print("\n✅ Setup complete! Run: ./start.sh or .\\start.ps1")
    except Exception as e:
        print(f"❌ Download failed: {e}")
        print("Manually download l2cs_net.onnx from:")
        print("https://drive.google.com/file/d/1RpaB-LQtHzsZOih-lHrr0Mdjnx8TVLIH")
        print("Place it in the models/ folder then run start.sh or start.ps1")
        sys.exit(1)
