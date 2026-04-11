import numpy as np
import pyvirtualcam


class VirtualCamOutput:
    def __init__(self, width=1280, height=720, fps=30):
        self.width = width
        self.height = height
        self.fps = fps
        self.cam = None

    def start(self):
        self.cam = pyvirtualcam.Camera(
            width=self.width,
            height=self.height,
            fps=self.fps,
        )
        print("Virtual camera initialized")

    def push(self, frame):
        if self.cam:
            frame = np.ascontiguousarray(frame)
            self.cam.send(frame)
            self.cam.sleep_until_next_frame()

    def stop(self):
        if self.cam:
            self.cam.close()
            print("Virtual camera stopped")
