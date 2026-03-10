"""知识库查询仓库"""
import json
from backend.data.database import get_conn


# ── 诊断知识库 ──────────────────────────────────────

def get_all_diagnoses_kb() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM diagnoses_kb").fetchall()
    result = []
    for row in rows:
        d = dict(row)
        d["match_symptoms"] = json.loads(d["match_symptoms"] or "[]")
        d["match_signs"]    = json.loads(d["match_signs"] or "[]")
        d["match_history"]  = json.loads(d["match_history"] or "[]")
        d["tags"]           = json.loads(d["tags"] or "[]")
        result.append(d)
    return result


# ── 治疗方案库 ──────────────────────────────────────

def get_treatments(disease_name: str, plan_type: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM treatments_kb WHERE disease_name = ? AND plan_type = ?",
            (disease_name, plan_type)
        ).fetchall()
    result = []
    for row in rows:
        t = dict(row)
        t["medications"]          = json.loads(t["medications"] or "[]")
        t["non_drug_treatments"]  = json.loads(t["non_drug_treatments"] or "[]")
        t["contraindications"]    = json.loads(t["contraindications"] or "[]")
        t["adjustments"]          = json.loads(t["adjustments"] or "[]")
        result.append(t)
    return result


def get_all_treatments(plan_type: str) -> list[dict]:
    """当按病名查不到时，返回该 plan_type 下所有方案作为备选"""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM treatments_kb WHERE plan_type = ?", (plan_type,)
        ).fetchall()
    result = []
    for row in rows:
        t = dict(row)
        t["medications"]          = json.loads(t["medications"] or "[]")
        t["non_drug_treatments"]  = json.loads(t["non_drug_treatments"] or "[]")
        t["contraindications"]    = json.loads(t["contraindications"] or "[]")
        t["adjustments"]          = json.loads(t["adjustments"] or "[]")
        result.append(t)
    return result


# ── 检查推荐库 ──────────────────────────────────────

def get_tests(disease_name: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM tests_kb WHERE disease_name = ? ORDER BY "
            "CASE priority WHEN 'required' THEN 1 WHEN 'recommended' THEN 2 ELSE 3 END",
            (disease_name,)
        ).fetchall()
    if not rows:
        # 降级：返回全部
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM tests_kb ORDER BY "
                "CASE priority WHEN 'required' THEN 1 WHEN 'recommended' THEN 2 ELSE 3 END"
            ).fetchall()
    return [dict(row) for row in rows]


# ── 知识条目搜索 ────────────────────────────────────

def search_knowledge(keyword: str, category: str = "全部") -> list[dict]:
    with get_conn() as conn:
        if category and category not in ("全部", ""):
            rows = conn.execute(
                """SELECT * FROM knowledge_items
                   WHERE type = ?
                     AND (title LIKE ? OR summary LIKE ? OR tags LIKE ?)
                   LIMIT 20""",
                (category, f"%{keyword}%", f"%{keyword}%", f"%{keyword}%")
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT * FROM knowledge_items
                   WHERE title LIKE ? OR summary LIKE ? OR tags LIKE ?
                   LIMIT 20""",
                (f"%{keyword}%", f"%{keyword}%", f"%{keyword}%")
            ).fetchall()
    result = []
    for row in rows:
        k = dict(row)
        k["tags"] = json.loads(k["tags"] or "[]")
        result.append(k)
    return result


def get_all_knowledge(limit: int = 20) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM knowledge_items LIMIT ?", (limit,)
        ).fetchall()
    result = []
    for row in rows:
        k = dict(row)
        k["tags"] = json.loads(k["tags"] or "[]")
        result.append(k)
    return result
