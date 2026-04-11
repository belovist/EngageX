import cv2


class CameraCapture:
    def __init__(self, camera_id: int = 0, width: int = 640, height: int = 480):
        self.requested_camera_id = camera_id
        self.camera_id = camera_id
        self.width = width
        self.height = height
        self.cap = None
        self.backend_name = "default"

    def _iter_candidates(self):
        candidate_ids = []
        for cam_id in [self.requested_camera_id, 0, 1, 2, 3]:
            if cam_id not in candidate_ids:
                candidate_ids.append(cam_id)

        backend_candidates = [("default", None)]
        for name in ("CAP_DSHOW", "CAP_MSMF"):
            backend_value = getattr(cv2, name, None)
            if backend_value is not None:
                backend_candidates.append((name.replace("CAP_", ""), backend_value))

        for camera_id in candidate_ids:
            for backend_name, backend_value in backend_candidates:
                yield camera_id, backend_name, backend_value

    def _open_capture(self, camera_id: int, backend_value):
        if backend_value is None:
            return cv2.VideoCapture(camera_id)
        return cv2.VideoCapture(camera_id, backend_value)

    def _capture_yields_frames(self, cap) -> bool:
        for _ in range(5):
            ok, frame = cap.read()
            if ok and frame is not None and getattr(frame, "size", 0) > 0:
                return True
        return False

    def start(self) -> None:
        self.stop()

        for camera_id, backend_name, backend_value in self._iter_candidates():
            cap = self._open_capture(camera_id, backend_value)
            if cap is None or not cap.isOpened():
                if cap is not None:
                    cap.release()
                continue

            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

            if not self._capture_yields_frames(cap):
                cap.release()
                continue

            self.cap = cap
            self.camera_id = camera_id
            self.backend_name = backend_name
            print(f"Camera initialized on index {self.camera_id} using {self.backend_name}")
            return

        raise RuntimeError(
            f"Failed to open camera {self.requested_camera_id} or nearby camera indices with a readable stream"
        )

    def restart(self) -> None:
        self.stop()
        self.start()

    def read(self):
        if self.cap is None:
            raise RuntimeError("CameraCapture not started")
        ok, frame = self.cap.read()
        if not ok or frame is None or getattr(frame, "size", 0) == 0:
            return None
        return frame

    def stop(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.cap = None
