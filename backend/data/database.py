"""SQLite 数据库连接与初始化"""
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "cdss.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row          # 支持按列名访问
    conn.execute("PRAGMA journal_mode=WAL") # 并发读写
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """建表，幂等（IF NOT EXISTS）"""
    with get_conn() as conn:
        conn.executescript("""
        -- ① 患者主表
        CREATE TABLE IF NOT EXISTS patients (
            patient_id       TEXT PRIMARY KEY,
            name             TEXT NOT NULL,
            gender           TEXT,
            age              INTEGER,
            department       TEXT,
            visit_id         TEXT,
            chief_complaint  TEXT,
            present_illness  TEXT,
            past_history     TEXT,
            chronic_diseases TEXT DEFAULT '[]',
            allergies        TEXT DEFAULT '[]',
            risk_tags        TEXT DEFAULT '[]',
            created_at       TEXT DEFAULT (datetime('now','localtime'))
        );

        -- ② 诊断知识库
        CREATE TABLE IF NOT EXISTS diagnoses_kb (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            disease_name        TEXT NOT NULL,
            icd_code            TEXT,
            match_symptoms      TEXT DEFAULT '[]',  -- JSON 数组
            match_signs         TEXT DEFAULT '[]',  -- JSON 数组
            match_history       TEXT DEFAULT '[]',  -- 匹配既往史关键词
            base_confidence     REAL DEFAULT 0.5,
            reasoning_template  TEXT,
            tags                TEXT DEFAULT '[]'
        );

        -- ③ 治疗方案库
        CREATE TABLE IF NOT EXISTS treatments_kb (
            plan_id             TEXT PRIMARY KEY,
            plan_type           TEXT NOT NULL,  -- 'common' | 'personalized'
            disease_name        TEXT NOT NULL,
            plan_name           TEXT NOT NULL,
            description         TEXT,
            medications         TEXT DEFAULT '[]',  -- JSON 数组
            non_drug_treatments TEXT DEFAULT '[]',
            contraindications   TEXT DEFAULT '[]',  -- 禁忌关键词，如 ["青霉素"]
            adjustments         TEXT DEFAULT '[]'   -- 个性化调整说明
        );

        -- ④ 检查推荐库
        CREATE TABLE IF NOT EXISTS tests_kb (
            test_id             TEXT PRIMARY KEY,
            test_name           TEXT NOT NULL,
            disease_name        TEXT NOT NULL,
            priority            TEXT DEFAULT 'recommended',  -- required/recommended/optional
            reason              TEXT,
            sample_requirements TEXT,
            category            TEXT DEFAULT '检验'  -- 检验/检查/影像
        );

        -- ⑤ 循证医学知识条目
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT,    -- 指南/药物/疾病/检验
            title       TEXT NOT NULL,
            summary     TEXT,
            content     TEXT,
            tags        TEXT DEFAULT '[]',
            source      TEXT,
            updated_at  TEXT
        );

        -- ⑥ 会话状态表（一次就诊 = 一条记录）
        CREATE TABLE IF NOT EXISTS sessions (
            session_id   TEXT PRIMARY KEY,  -- 等同 visit_id
            patient_id   TEXT NOT NULL,
            state        TEXT DEFAULT '{}', -- JSON blob
            created_at   TEXT DEFAULT (datetime('now','localtime')),
            updated_at   TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        );
        """)
    print(f"[DB] 初始化完成 → {DB_PATH}")


# 供外部直接执行初始化
if __name__ == "__main__":
    init_db()
