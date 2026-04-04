import time
from pathlib import Path
import sys
from typing import Dict, Optional


_THIS_FILE = Path(__file__).resolve()
_PROJECT_ROOT = _THIS_FILE.parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from score_calculator import AttentivenessScoreCalculator


class AttentionEngine:
    def __init__(self):
        self.calculator = AttentivenessScoreCalculator(
            head_pose_weight=0.6,
            gaze_weight=0.4,
            ema_alpha=0.3,
        )

    def fuse(self, headpose: Optional[Dict[str, float]], gaze_score: Optional[float], microexp_score: Optional[float]) -> float:
        gaze_payload = None
        if gaze_score is not None:
            gaze_payload = {"gaze_score": float(gaze_score)}

        metrics = self.calculator.calculate_with_metrics(
            head_pose_angles=headpose,
            gaze_vector=gaze_payload,
            emotion=microexp_score,
        )
        smoothed = metrics.get("smoothed_score")
        return float(smoothed) if smoothed is not None else 0.0

    def build_event(self, user_id: str, score_0_to_1: float, state: str = "Tracking") -> Dict:
        return {
            "user_id": user_id,
            "score": round(max(0.0, min(1.0, score_0_to_1)) * 100.0, 2),
            "timestamp": time.time(),
            "state": state,
            "source": "desktop-client",
        }
