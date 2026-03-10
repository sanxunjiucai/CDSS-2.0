"""患者数据仓库"""
import json
from backend.data.database import get_conn


def get_patient(patient_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM patients WHERE patient_id = ?", (patient_id,)
        ).fetchone()
    if not row:
        return None
    p = dict(row)
    p["chronic_diseases"] = json.loads(p["chronic_diseases"] or "[]")
    p["allergies"]        = json.loads(p["allergies"] or "[]")
    p["risk_tags"]        = json.loads(p["risk_tags"] or "[]")
    return p


def list_patients() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM patients").fetchall()
    result = []
    for row in rows:
        p = dict(row)
        p["chronic_diseases"] = json.loads(p["chronic_diseases"] or "[]")
        p["allergies"]        = json.loads(p["allergies"] or "[]")
        p["risk_tags"]        = json.loads(p["risk_tags"] or "[]")
        result.append(p)
    return result
