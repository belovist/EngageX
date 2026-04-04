import sqlite3
from pathlib import Path
from typing import Dict, List


class Database:
    def __init__(self, db_path: str = "attention_scores.db"):
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._create_tables()

    def _create_tables(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attention_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                score REAL NOT NULL,
                timestamp REAL NOT NULL,
                state TEXT,
                source TEXT
            )
            """
        )
        self.conn.commit()

    def insert_score(self, row: Dict) -> None:
        self.conn.execute(
            "INSERT INTO attention_scores (user_id, score, timestamp, state, source) VALUES (?, ?, ?, ?, ?)",
            (
                row["user_id"],
                row["score"],
                row["timestamp"],
                row.get("state"),
                row.get("source"),
            ),
        )
        self.conn.commit()

    def latest_users(self) -> List[Dict]:
        rows = self.conn.execute(
            """
            SELECT user_id, score, timestamp, state, source
            FROM attention_scores
            WHERE id IN (
                SELECT MAX(id)
                FROM attention_scores
                GROUP BY user_id
            )
            ORDER BY user_id
            """
        ).fetchall()

        return [
            {
                "user_id": r[0],
                "score": r[1],
                "timestamp": r[2],
                "state": r[3],
                "source": r[4],
            }
            for r in rows
        ]

    def user_history(self, user_id: str, limit: int = 100) -> List[Dict]:
        rows = self.conn.execute(
            """
            SELECT user_id, score, timestamp, state, source
            FROM attention_scores
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (user_id, int(limit)),
        ).fetchall()

        return [
            {
                "user_id": r[0],
                "score": r[1],
                "timestamp": r[2],
                "state": r[3],
                "source": r[4],
            }
            for r in rows
        ]

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass
