import cv2
import pyvirtualcam


class VirtualCamOutput:
    def __init__(self, width: int, height: int, fps: int = 30):
        self.width = int(width)
        self.height = int(height)
        self.fps = int(fps)
        self.cam = None

    def start(self) -> None:
        self.cam = pyvirtualcam.Camera(width=self.width, height=self.height, fps=self.fps)
        print(f"Virtual camera started: {self.cam.device}")

    def push(self, frame_bgr) -> None:
        if self.cam is None:
            raise RuntimeError("VirtualCamOutput not started")

        frame = cv2.resize(frame_bgr, (self.width, self.height), interpolation=cv2.INTER_LINEAR)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        self.cam.send(frame_rgb)
        self.cam.sleep_until_next_frame()

    def stop(self) -> None:
        if self.cam is not None:
            self.cam.close()
            self.cam = None
