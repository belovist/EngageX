"""
EngageX model setup script.
Run once before starting: python setup_models.py
"""

import os
import subprocess
import sys
import urllib.request

MODELS_DIR = "models"
ONNX_PATH = os.path.join(MODELS_DIR, "l2cs_net.onnx")
FACE_LANDMARKER_TASK_PATH = os.path.join(MODELS_DIR, "face_landmarker.task")
ONNX_FILE_ID = "1RpaB-LQtHzsZOih-lHrr0Mdjnx8TVLIH"
FACE_LANDMARKER_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"


def install_gdown():
    print("Installing gdown...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown", "-q"])


def download_with_gdown():
    import gdown

    print("Downloading ONNX model from Google Drive...")
    url = f"https://drive.google.com/uc?id={ONNX_FILE_ID}"
    gdown.download(url, ONNX_PATH, quiet=False, fuzzy=True)


def download_file(url, dest, label):
    print(f"Downloading {label}...")
    urllib.request.urlretrieve(url, dest)


def onnx_ready():
    if not os.path.exists(ONNX_PATH):
        return False

    size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
    if size_mb > 50:
        print(f"ONNX model already exists ({size_mb:.1f} MB), skipping.")
        return True

    print(f"ONNX model is too small ({size_mb:.1f} MB), re-downloading...")
    os.remove(ONNX_PATH)
    return False


def face_landmarker_ready():
    if not os.path.exists(FACE_LANDMARKER_TASK_PATH):
        return False

    size_mb = os.path.getsize(FACE_LANDMARKER_TASK_PATH) / (1024 * 1024)
    if size_mb > 1:
        print(f"Face landmarker model already exists ({size_mb:.1f} MB), skipping.")
        return True

    print(f"Face landmarker model is too small ({size_mb:.1f} MB), re-downloading...")
    os.remove(FACE_LANDMARKER_TASK_PATH)
    return False


if __name__ == "__main__":
    os.makedirs(MODELS_DIR, exist_ok=True)
    setup_ok = True

    if not onnx_ready():
        try:
            import gdown  # noqa: F401
        except ImportError:
            install_gdown()

        try:
            download_with_gdown()
            size_mb = os.path.getsize(ONNX_PATH) / (1024 * 1024)
            if size_mb < 50:
                print(f"Download incomplete ({size_mb:.1f} MB). Try manually downloading.")
                os.remove(ONNX_PATH)
                setup_ok = False
            else:
                print(f"ONNX model ready ({size_mb:.1f} MB)")
        except Exception as exc:
            print(f"ONNX download failed: {exc}")
            print("Manually download l2cs_net.onnx from:")
            print("https://drive.google.com/file/d/1RpaB-LQtHzsZOih-lHrr0Mdjnx8TVLIH")
            print("Place it in the models folder.")
            setup_ok = False

    if not face_landmarker_ready():
        try:
            download_file(
                FACE_LANDMARKER_URL,
                FACE_LANDMARKER_TASK_PATH,
                "MediaPipe face landmarker model",
            )
            size_mb = os.path.getsize(FACE_LANDMARKER_TASK_PATH) / (1024 * 1024)
            if size_mb < 1:
                print(f"Face landmarker download incomplete ({size_mb:.1f} MB).")
                os.remove(FACE_LANDMARKER_TASK_PATH)
                setup_ok = False
            else:
                print(f"Face landmarker model ready ({size_mb:.1f} MB)")
        except Exception as exc:
            print(f"Face landmarker download failed: {exc}")
            print("Manually download face_landmarker.task from:")
            print(FACE_LANDMARKER_URL)
            print("Place it in the models folder.")
            setup_ok = False

    if not setup_ok:
        sys.exit(1)

    launcher = ".\\start.ps1" if os.name == "nt" else "./start.sh"
    print(f"\nSetup complete! Run: {launcher}")
