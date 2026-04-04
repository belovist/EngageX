import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path
import sys

import cv2

from attention_engine import AttentionEngine
from camera_capture import CameraCapture
from face_detection import FaceDetector
from headpose import HeadPoseEstimator
from virtual_cam_output import VirtualCamOutput


_THIS_FILE = Path(__file__).resolve()
_PROJECT_ROOT = _THIS_FILE.parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from gaze_tracker import GazeTracker


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenCV -> pyvirtualcam -> OBS Virtual Camera")
    parser.add_argument("--camera-id", type=int, default=0, help="Physical webcam index")
    parser.add_argument("--width", type=int, default=1280, help="Virtual camera frame width")
    parser.add_argument("--height", type=int, default=720, help="Virtual camera frame height")
    parser.add_argument("--fps", type=int, default=30, help="Virtual camera FPS")
    parser.add_argument("--user-id", default="desktop-user", help="User id for local scoring")
    parser.add_argument("--backend-url", default="http://127.0.0.1:8010", help="Backend base URL")
    parser.add_argument("--send-interval", type=float, default=1.5, help="Seconds between score posts")
    parser.add_argument("--gaze-model-path", default="l2cs_net.onnx", help="Path to L2CS ONNX model")
    parser.add_argument("--show-preview", action="store_true", help="Show local OpenCV preview")
    return parser.parse_args()


def score_to_label(score_0_to_1: float) -> str:
    pct = score_0_to_1 * 100.0
    if pct >= 75:
        return "Attentive"
    if pct >= 50:
        return "Moderate"
    return "Distracted"


def post_score_event(base_url: str, payload: dict, timeout: float = 4.0) -> bool:
    endpoint = f"{base_url.rstrip('/')}/api/attention/score"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return 200 <= int(response.status) < 300
    except (urllib.error.URLError, TimeoutError):
        return False


def process_frame(
    frame,
    engine: AttentionEngine,
    detector: FaceDetector,
    headpose: HeadPoseEstimator,
    gaze: GazeTracker,
    user_id: str,
):
    det = detector.detect(frame)

    headpose_result = None
    gaze_score = None

    if det["person_detected"] and det["face_roi"] is not None:
        roi = det["face_roi"]
        headpose_result = headpose.estimate(roi)
        gaze_ok, gaze_result = gaze.process(roi)
        if gaze_ok and gaze_result is not None:
            gaze_score = gaze_result.get("gaze_score")

        bbox = det["bbox"]
        if bbox is not None:
            x1, y1, x2, y2 = [int(v) for v in bbox]
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
    cv2.putText(
        frame,
        "OpenCV -> process -> pyvirtualcam -> OBS/Zoom/Meet",
        (20, 74),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (180, 180, 180),
        1,
    )

    if headpose_result is not None:
        cv2.putText(
            frame,
            f"HeadPose Y:{headpose_result['yaw']:.1f} P:{headpose_result['pitch']:.1f}",
            (20, 104),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (180, 180, 180),
            1,
        )

    if gaze_score is not None:
        cv2.putText(
            frame,
            f"GazeScore: {gaze_score * 100:.1f}%",
            (20, 132),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (180, 180, 180),
            1,
        )

    return frame, event


def main() -> None:
    args = parse_args()

    capture = CameraCapture(camera_id=args.camera_id)
    vcam = VirtualCamOutput(width=args.width, height=args.height, fps=args.fps)
    engine = AttentionEngine()
    detector = FaceDetector()
    headpose = HeadPoseEstimator()
    gaze = GazeTracker(model_path=args.gaze_model_path)

    capture.start()
    vcam.start()

    print("Streaming to OBS Virtual Camera. Open Zoom/Google Meet and select the OBS virtual camera device.")
    print("Press Ctrl+C to stop.")

    last_print = 0.0
    last_send = 0.0

    try:
        while True:
            frame = capture.read()
            if frame is None:
                time.sleep(0.01)
                continue

            processed, event = process_frame(
                frame,
                engine=engine,
                detector=detector,
                headpose=headpose,
                gaze=gaze,
                user_id=args.user_id,
            )
            vcam.push(processed)

            now = time.time()
            if now - last_send >= max(0.2, args.send_interval):
                sent = post_score_event(args.backend_url, event)
                event["sent"] = sent
                last_send = now

            if now - last_print >= 2.0:
                sent_txt = "yes" if event.get("sent") else "no"
                print(
                    f"[{time.strftime('%H:%M:%S')}] score={event['score']:.1f}% "
                    f"state={event['state']} sent={sent_txt}"
                )
                last_print = now

            if args.show_preview:
                cv2.imshow("Virtual Cam Preview", processed)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("\nStopping virtual camera stream...")

    finally:
        capture.stop()
        vcam.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
