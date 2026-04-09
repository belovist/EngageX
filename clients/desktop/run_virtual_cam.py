import argparse
import json
import time
import urllib.error
import urllib.request

import cv2
import numpy as np

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
    parser.add_argument("--user-id", default="desktop-user")
    parser.add_argument("--backend-url", default="http://127.0.0.1:8000")
    parser.add_argument("--send-interval", type=float, default=1.5)
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
    endpoint = f"{base_url.rstrip('/')}/api/attention/score"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            return 200 <= int(response.status) < 300
    except:
        return False


def process_frame(frame, engine, detector, headpose, gaze, user_id):
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

    capture = CameraCapture(camera_id=args.camera_id)
    vcam = VirtualCamOutput(width=args.width, height=args.height, fps=args.fps)

    engine = AttentionEngine()
    detector = FaceDetector()
    headpose = HeadPoseEstimator()
    gaze = GazeTracker(model_path=args.gaze_model_path)

    capture.start()
    vcam.start()

    print("✅ Virtual camera started")
    print("Press Ctrl+C to stop")

    last_send = 0

    try:
        while True:
            frame = capture.read()

            if frame is None:
                time.sleep(0.01)
                continue

            frame = frame.copy()

            processed, event = process_frame(
                frame,
                engine,
                detector,
                headpose,
                gaze,
                args.user_id,
            )

            processed = processed.copy()
            processed = cv2.resize(processed, (args.width, args.height))
            processed = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
            processed = np.ascontiguousarray(processed)

            vcam.push(processed)

            now = time.time()
            if now - last_send >= args.send_interval:
                post_score_event(args.backend_url, event)
                last_send = now

            if args.show_preview:
                cv2.imshow("Preview", processed)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("Stopping...")

    finally:
        capture.stop()
        vcam.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()