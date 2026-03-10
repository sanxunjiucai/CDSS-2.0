"""会话状态仓库（持久化用户在各步骤的选择）"""
import json
from datetime import datetime
from backend.data.database import get_conn


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_session(session_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    if not row:
        return None
    s = dict(row)
    s["state"] = json.loads(s["state"] or "{}")
    return s


def get_or_create_session(session_id: str, patient_id: str) -> dict:
    session = get_session(session_id)
    if session:
        return session
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (session_id, patient_id, state, created_at, updated_at) "
            "VALUES (?,?,?,?,?)",
            (session_id, patient_id, "{}", _now(), _now())
        )
    return {"session_id": session_id, "patient_id": patient_id, "state": {}}


def update_session_state(session_id: str, patch: dict) -> dict:
    """合并更新 state 的某些字段"""
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id!r} not found")
    state = session["state"]
    state.update(patch)
    with get_conn() as conn:
        conn.execute(
            "UPDATE sessions SET state = ?, updated_at = ? WHERE session_id = ?",
            (json.dumps(state, ensure_ascii=False), _now(), session_id)
        )
    return state


def get_session_state(session_id: str) -> dict:
    session = get_session(session_id)
    return session["state"] if session else {}
