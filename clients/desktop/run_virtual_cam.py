import argparse
import json
import time
import urllib.error
import urllib.request

import cv2

from .attention_engine import AttentionEngine
from .camera_capture import CameraCapture
from .face_detection import FaceDetector
from .headpose import HeadPoseEstimator
from .virtual_cam_output import VirtualCamOutput
from core.gaze_tracker import GazeTracker


def parse_args():
    parser = argparse.ArgumentParser(description="OpenCV -> pyvirtualcam -> OBS Virtual Camera")
    parser.add_argument("--camera-id", type=int, default=0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--vcam-backend", default=None)
    parser.add_argument("--vcam-device", default=None)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--user-id", default="desktop-user")
    parser.add_argument("--backend-url", default="http://127.0.0.1:8000")
    parser.add_argument("--send-interval", type=float, default=3.0)
    parser.add_argument("--gaze-model-path", default="models/l2cs_net.onnx")
    parser.add_argument("--show-preview", action="store_true")
    return parser.parse_args()


def score_to_label(score):
    pct = score * 100
    if pct >= 75:
        return "Attentive"
    if pct >= 50:
        return "Moderate"
    return "Distracted"


def post_score_event(base_url, payload):
    endpoint = f"{base_url.rstrip('/')}/api/sessions/{payload['session_id']}/scores"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            return 200 <= int(response.status) < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def process_frame(frame, engine, detector, headpose, gaze, session_id, user_id):
    det = detector.detect(frame)

    headpose_result = None
    gaze_score = None

    if det["person_detected"] and det["face_roi"] is not None:
        roi = det["face_roi"]

        headpose_result = headpose.estimate(roi)

        gaze_ok, gaze_result = gaze.process(roi)
        if gaze_ok and gaze_result:
            gaze_score = gaze_result.get("gaze_score")

        if det["bbox"]:
            x1, y1, x2, y2 = map(int, det["bbox"])
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 120), 2)

    score = engine.fuse(headpose_result, gaze_score, None)
    label = score_to_label(score)
    event = engine.build_event(user_id=user_id, score_0_to_1=score, state=label)
    event["session_id"] = session_id

    cv2.putText(
        frame,
        f"Attention: {event['score']:.1f}% ({label})",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (40, 220, 100),
        2,
    )

    return frame, event


def main():
    args = parse_args()

    capture = CameraCapture(camera_id=args.camera_id, width=args.width, height=args.height)
    vcam = VirtualCamOutput(width=args.width, height=args.height, fps=args.fps)

    engine = AttentionEngine()
    detector = FaceDetector()
    headpose = HeadPoseEstimator()
    gaze = GazeTracker(model_path=args.gaze_model_path)

    capture.start()
    vcam.start(preferred_backend=args.vcam_backend, preferred_device=args.vcam_device)

    startup_payload = {
        "mode": "virtual-camera",
        "camera_id": capture.camera_id,
        "camera_backend": capture.backend_name,
        "virtual_camera_backend": vcam.backend,
        "virtual_camera_device": vcam.device,
        "width": vcam.width,
        "height": vcam.height,
        "fps": vcam.fps,
    }

    if vcam.backend == "obs":
        startup_payload["note"] = (
            "OBS installs the virtual camera device, but OBS itself is not a reliable place to preview "
            "its own built-in virtual camera as an input. Use Meet, Zoom, or Teams for validation."
        )

    print("Virtual camera started", flush=True)
    print(
        f"Using webcam index {capture.camera_id} via {capture.backend_name} and publishing "
        f"{vcam.width}x{vcam.height}@{args.fps} to {vcam.device} via {vcam.backend}",
        flush=True,
    )
    print(f"ENGAGEX_READY {json.dumps(startup_payload, separators=(',', ':'))}", flush=True)
    print("Press Ctrl+C to stop", flush=True)

    last_send = 0.0
    consecutive_empty_frames = 0

    try:
        while True:
            frame = capture.read()

            if frame is None:
                consecutive_empty_frames += 1
                if consecutive_empty_frames == 1 or consecutive_empty_frames % 30 == 0:
                    print(
                        f"No frame received from webcam index {capture.camera_id}. "
                        "Make sure OBS, Zoom, Meet, or a browser is not holding the real camera.",
                        flush=True,
                    )

                if consecutive_empty_frames >= max(10, args.fps):
                    print("Trying to reopen the webcam...", flush=True)
                    try:
                        capture.restart()
                        print(
                            f"Recovered webcam on index {capture.camera_id} via {capture.backend_name}",
                            flush=True,
                        )
                        consecutive_empty_frames = 0
                    except RuntimeError as exc:
                        print(f"Webcam recovery failed: {exc}", flush=True)
                        time.sleep(1.0)
                        continue

                time.sleep(0.05)
                continue

            consecutive_empty_frames = 0
            frame = frame.copy()

            processed, event = process_frame(
                frame,
                engine,
                detector,
                headpose,
                gaze,
                args.session_id,
                args.user_id,
            )

            vcam.push(processed)

            now = time.time()
            if now - last_send >= args.send_interval:
                sent = post_score_event(args.backend_url, event)
                if not sent:
                    print(f"Warning: could not send score to {args.backend_url.rstrip('/')}", flush=True)
                last_send = now

            if args.show_preview:
                preview_frame = cv2.resize(processed, (args.width, args.height))
                cv2.imshow("EngageX Virtual Camera Preview", preview_frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("Stopping...", flush=True)

    finally:
        capture.stop()
        vcam.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
