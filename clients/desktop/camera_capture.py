import cv2


class CameraCapture:
    def __init__(self, camera_id: int = 0):
        self.camera_id = camera_id
        self.cap = None

    def start(self) -> None:
        self.cap = cv2.VideoCapture(self.camera_id)
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open camera {self.camera_id}")

    def read(self):
        if self.cap is None:
            raise RuntimeError("CameraCapture not started")
        ok, frame = self.cap.read()
        if not ok:
            return None
        return frame

    def stop(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.cap = None
