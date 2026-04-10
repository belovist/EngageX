from __future__ import annotations

import json
import math
import time
import urllib.request

SESSION_ID = "SES-DEMO123456"
USER_ID = "student-01"
URL = f"http://127.0.0.1:8000/api/sessions/{SESSION_ID}/scores"


def main() -> None:
    i = 0
    print(f"Publishing simulated attention scores to {URL} for {USER_ID}")

    while True:
        score = 70 + 18 * math.sin(i / 5.0)
        payload = {
            "session_id": SESSION_ID,
            "user_id": USER_ID,
            "score": round(max(0, min(100, score)), 2),
            "timestamp": time.time(),
            "state": "Attentive" if score >= 60 else "Distracted",
            "pose_score": round(max(0, min(1, score / 100)), 2),
            "gaze_score": round(max(0, min(1, (score - 8) / 100)), 2),
            "source": "simulator",
        }

        req = urllib.request.Request(
            URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=5):
            pass

        i += 1
        time.sleep(1.25)


if __name__ == "__main__":
    main()
