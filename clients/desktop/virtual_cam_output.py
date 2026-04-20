import platform

import cv2
import numpy as np
import pyvirtualcam


class VirtualCamOutput:
    def __init__(self, width=1280, height=720, fps=30):
        self.requested_width = width
        self.requested_height = height
        self.width = width
        self.height = height
        self.fps = fps
        self.cam = None
        self.backend = None
        self.device = None

    def _iter_resolution_candidates(self):
        candidates = [(self.requested_width, self.requested_height)]
        for candidate in [(1280, 720), (960, 540), (854, 480), (640, 480)]:
            if candidate not in candidates:
                candidates.append(candidate)
        return candidates

    def _iter_backend_candidates(self, preferred_backend=None, preferred_device=None):
        candidates = []

        def add_candidate(backend, device):
            candidate = (backend, device)
            if candidate not in candidates:
                candidates.append(candidate)

        add_candidate(preferred_backend, preferred_device)

        if platform.system() == "Windows":
            add_candidate("obs", "OBS Virtual Camera")
            add_candidate("obs", None)
            add_candidate("unitycapture", preferred_device)
            add_candidate("unitycapture", None)

        if preferred_device and not preferred_backend:
            add_candidate(None, preferred_device)

        add_candidate(None, None)
        return candidates

    def start(self, preferred_backend=None, preferred_device=None):
        errors = []

        for width, height in self._iter_resolution_candidates():
            for backend, device in self._iter_backend_candidates(preferred_backend, preferred_device):
                kwargs = {
                    "width": width,
                    "height": height,
                    "fps": self.fps,
                    "fmt": pyvirtualcam.PixelFormat.BGR,
                }

                if backend:
                    kwargs["backend"] = backend
                if device:
                    kwargs["device"] = device

                try:
                    cam = pyvirtualcam.Camera(**kwargs)
                except Exception as exc:
                    errors.append(
                        f"{width}x{height}@{self.fps} backend={backend or 'auto'} device={device or 'auto'}: {exc}"
                    )
                    continue

                self.cam = cam
                self.width = width
                self.height = height
                self.backend = cam.backend
                self.device = cam.device
                print(
                    f"Virtual camera initialized: {self.device} via {self.backend} "
                    f"at {self.width}x{self.height}@{self.fps}",
                    flush=True,
                )
                return

        raise RuntimeError(
            "Failed to start a virtual camera. Close OBS, Meet, Zoom, Teams, and any browser tab that may already "
            "be using the OBS Virtual Camera, then start EngageX first and reopen the meeting app. "
            + " | ".join(errors[-6:])
        )

    def push(self, frame):
        if self.cam:
            if frame.shape[:2] != (self.height, self.width):
                frame = cv2.resize(frame, (self.width, self.height))
            frame = np.ascontiguousarray(frame, dtype=np.uint8)
            self.cam.send(frame)
            self.cam.sleep_until_next_frame()

    def stop(self):
        if self.cam:
            self.cam.close()
            self.cam = None
            print("Virtual camera stopped", flush=True)
