from pathlib import Path
import sys
from typing import Dict, Optional


_THIS_FILE = Path(__file__).resolve()
_PROJECT_ROOT = _THIS_FILE.parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from head_pose import HeadPoseEstimator as RootHeadPoseEstimator


class HeadPoseEstimator:
    def __init__(self):
        self.estimator = RootHeadPoseEstimator()

    def estimate(self, frame, face_bbox=None) -> Optional[Dict[str, float]]:
        # face_bbox is optional here because face ROI is usually passed directly.
        _ = face_bbox
        ok, result = self.estimator.process(frame)
        if not ok:
            return None
        return result
