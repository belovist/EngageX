"""
Real-Time Attention Monitoring System.
Main pipeline integrating all stages: Gatekeeper -> Head Pose -> Gaze -> Score.
"""

import cv2

from .gatekeeper import Gatekeeper
from .gaze_tracker import GazeTracker
from .head_pose import HeadPoseEstimator
from .score_calculator import AttentivenessScoreCalculator


class AttentionMonitor:
    """Main pipeline for real-time attention monitoring."""

    def __init__(
        self,
        camera_id=0,
        yolo_model="yolov8n.pt",
        gaze_model_path=None,
        head_pose_weight=0.6,
        gaze_weight=0.4,
        ema_alpha=0.3,
        display=True,
    ):
        self.gatekeeper = Gatekeeper(model_path=yolo_model)
        self.head_pose_estimator = HeadPoseEstimator()
        self.gaze_tracker = GazeTracker(model_path=gaze_model_path)
        self.score_calculator = AttentivenessScoreCalculator(
            head_pose_weight=head_pose_weight,
            gaze_weight=gaze_weight,
            ema_alpha=ema_alpha,
        )

        self.camera_id = camera_id
        self.cap = None
        self.display = display

        self.frame_count = 0
        self.person_detected_count = 0
        self.head_pose_success_count = 0
        self.gaze_success_count = 0

    def initialize_camera(self):
        """Initialize webcam capture with Windows-friendly fallbacks."""
        candidate_ids = []
        for cam_id in [self.camera_id, 0, 1, 2, 3]:
            if cam_id not in candidate_ids:
                candidate_ids.append(cam_id)

        selected_cap = None
        selected_camera_id = None

        for candidate_id in candidate_ids:
            candidates = [cv2.VideoCapture(candidate_id)]
            for backend in (cv2.CAP_DSHOW, cv2.CAP_MSMF):
                candidates.append(cv2.VideoCapture(candidate_id, backend))

            for cap in candidates:
                if cap is not None and cap.isOpened():
                    # Some backends report opened but do not actually yield frames.
                    readable = False
                    for _ in range(5):
                        ok, _frame = cap.read()
                        if ok:
                            readable = True
                            break
                    if readable:
                        selected_cap = cap
                        selected_camera_id = candidate_id
                        break

                if cap is not None:
                    cap.release()

            if selected_cap is not None:
                break

        if selected_cap is None:
            raise RuntimeError(f"Failed to open camera {self.camera_id} or nearby camera indices")

        self.cap = selected_cap
        self.camera_id = selected_camera_id if selected_camera_id is not None else self.camera_id
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        print(f"Camera initialized on index {self.camera_id}")

    def draw_info(self, frame, bbox, head_pose_angles, gaze_vector, scores, metrics=None):
        h, w = frame.shape[:2]

        if bbox is not None:
            x1, y1, x2, y2 = bbox.astype(int)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                frame,
                "Person Detected",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2,
            )

        if head_pose_angles:
            yaw = head_pose_angles["yaw"]
            pitch = head_pose_angles["pitch"]
            roll = head_pose_angles["roll"]
            text = f"Head: Yaw={yaw:.1f} Pitch={pitch:.1f} Roll={roll:.1f}"
            cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        if gaze_vector:
            yaw = gaze_vector["yaw"]
            pitch = gaze_vector["pitch"]
            text = f"Gaze: Yaw={yaw:.1f} Pitch={pitch:.1f}"
            cv2.putText(frame, text, (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        _, smooth_score = scores
        percent = None
        label_text = ""

        if metrics is not None:
            percent = metrics.get("attention_percent")
            label_text = metrics.get("label") or ""
            if smooth_score is None:
                smooth_score = metrics.get("smoothed_score")

        if smooth_score is not None:
            color = (0, int(255 * smooth_score), int(255 * (1 - smooth_score)))
            bar_width = 200
            bar_height = 20
            bar_x = 10
            bar_y = h - 40

            cv2.rectangle(
                frame,
                (bar_x, bar_y),
                (bar_x + bar_width, bar_y + bar_height),
                (50, 50, 50),
                -1,
            )

            score_width = int(bar_width * smooth_score)
            cv2.rectangle(
                frame,
                (bar_x, bar_y),
                (bar_x + score_width, bar_y + bar_height),
                color,
                -1,
            )

            if percent is not None and label_text:
                score_text = f"Attention: {percent}% - {label_text}"
            else:
                score_text = f"Attentiveness: {smooth_score:.2f}"

            cv2.putText(
                frame,
                score_text,
                (bar_x, bar_y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
            )

        stats_text = (
            f"Frames: {self.frame_count} | "
            f"Person: {self.person_detected_count} | "
            f"Head Pose: {self.head_pose_success_count} | "
            f"Gaze: {self.gaze_success_count}"
        )
        cv2.putText(frame, stats_text, (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

    def process_frame(self, frame):
        self.frame_count += 1

        person_detected, cropped_frame, bbox = self.gatekeeper.process(frame)

        if not person_detected or cropped_frame is None:
            last_smooth = self.score_calculator.smoothed_score
            last_pct = self.score_calculator.score_to_percent(last_smooth)
            return {
                "person_detected": False,
                "bbox": None,
                "head_pose_angles": None,
                "gaze_vector": None,
                "scores": (None, last_smooth),
                "metrics": {
                    "person_detected": False,
                    "instantaneous_score": None,
                    "smoothed_score": last_smooth,
                    "instantaneous_percent": None,
                    "attention_percent": last_pct,
                    "label": "No person",
                    "pose_score": None,
                    "gaze_score": None,
                },
            }

        self.person_detected_count += 1

        # 1. Head Pose Tracking
        head_pose_success, head_pose_angles = self.head_pose_estimator.process(cropped_frame)
        if not head_pose_success:
            head_pose_angles = None
        else:
            self.head_pose_success_count += 1      
        
        # 2. Gaze Tracking
        gaze_success, gaze_vector = self.gaze_tracker.process(cropped_frame)
        if not gaze_success:
            gaze_vector = None
        else:
            self.gaze_success_count += 1

        # 3. Final Scoring
        metrics = self.score_calculator.calculate_with_metrics(
            head_pose_angles=head_pose_angles,
            gaze_vector=gaze_vector,
            emotion=None,
        )
        metrics["person_detected"] = True
        instantaneous_score = metrics["instantaneous_score"]
        smoothed_score = metrics["smoothed_score"]

        return {
            "person_detected": True,
            "bbox": bbox,
            "head_pose_angles": head_pose_angles,
            "gaze_vector": gaze_vector,
            "scores": (instantaneous_score, smoothed_score),
            "metrics": metrics,
        }

    def run(self):
        self.initialize_camera()

        print("Starting Attention Monitoring System...")
        print("Press 'q' to quit")

        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    print("Failed to read frame")
                    break

                results = self.process_frame(frame)

                if self.display:
                    self.draw_info(
                        frame,
                        results["bbox"],
                        results["head_pose_angles"],
                        results["gaze_vector"],
                        results["scores"],
                        metrics=results.get("metrics"),
                    )

                    cv2.imshow("Attention Monitor", frame)

                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                if self.frame_count % 30 == 0:
                    _, smooth_score = results["scores"]
                    if smooth_score is not None:
                        print(f"Frame {self.frame_count}: Attentiveness Score = {smooth_score:.3f}")

        except KeyboardInterrupt:
            print("\nInterrupted by user")

        finally:
            self.cleanup()

    def cleanup(self):
        if self.cap is not None:
            self.cap.release()
        cv2.destroyAllWindows()

        print("\n=== Final Statistics ===")
        print(f"Total frames processed: {self.frame_count}")
        print(f"Person detected: {self.person_detected_count}")
        print(f"Head pose successful: {self.head_pose_success_count}")
        print(f"Gaze tracking successful: {self.gaze_success_count}")


def main():
    monitor = AttentionMonitor(
        camera_id=0,
        display=True,
        head_pose_weight=0.6,
        gaze_weight=0.4,
        ema_alpha=0.3,
    )
    monitor.run()


if __name__ == "__main__":
    main()
