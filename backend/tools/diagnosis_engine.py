"""
诊断评分引擎
输入：已确认的实体列表 + 知识库记录
输出：按置信度排序的诊断推荐列表
"""

EVIDENCE_WEIGHT = {
    "症状": 1.0,
    "体征": 1.2,   # 体征权重略高
    "疾病": 0.8,   # 既往史是背景因素
    "检查": 1.1,
    "风险": 0.6,
}


def score_diagnoses(entities: list[dict], kb_rows: list[dict]) -> list[dict]:
    """
    对知识库中每条诊断，按实体命中情况计算最终置信度，返回 Top-5。

    评分算法：
      命中率 = 命中关键词数 / 全部关键词数
      原始分 = base_confidence * (0.4 + 0.6 * 命中率)
      实体加权：已确认实体额外 +0.05/个，体征命中额外 +0.03/个
    """
    confirmed_texts  = {e["text"] for e in entities if e.get("confirmed", e.get("status") == "accepted")}
    symptom_texts    = {e["text"] for e in entities if e["category"] == "症状"}
    sign_texts       = {e["text"] for e in entities if e["category"] == "体征"}
    history_texts    = {e["text"] for e in entities if e["category"] == "疾病"}
    all_texts        = {e["text"] for e in entities}

    results = []
    for row in kb_rows:
        match_sym  = [w for w in row["match_symptoms"] if w in all_texts]
        match_sign = [w for w in row["match_signs"]    if w in all_texts]
        match_hist = [w for w in row["match_history"]  if w in all_texts]

        total_keywords = (
            len(row["match_symptoms"]) +
            len(row["match_signs"]) +
            len(row["match_history"])
        )
        hit_count = len(match_sym) + len(match_sign) + len(match_hist)

        if total_keywords == 0 or hit_count == 0:
            continue  # 无任何命中，跳过

        hit_rate   = hit_count / total_keywords
        base       = row["base_confidence"]
        confidence = base * (0.4 + 0.6 * hit_rate)

        # 已确认实体加权
        confirmed_hits = len([w for w in (match_sym + match_sign + match_hist)
                               if w in confirmed_texts])
        confidence += confirmed_hits * 0.05

        # 体征命中加权
        confidence += len(match_sign) * 0.03

        confidence = min(round(confidence, 3), 0.99)

        # 构建推理文案（列出命中的证据）
        evidence_parts = []
        if match_sym:
            evidence_parts.append(f"症状命中：{'、'.join(match_sym)}")
        if match_sign:
            evidence_parts.append(f"体征命中：{'、'.join(match_sign)}")
        if match_hist:
            evidence_parts.append(f"既往史：{'、'.join(match_hist)}")

        reasoning = row["reasoning_template"]
        if evidence_parts:
            reasoning += "。" + "；".join(evidence_parts) + "。"

        results.append({
            "disease_name": row["disease_name"],
            "icd_code":     row.get("icd_code", ""),
            "confidence":   confidence,
            "reasoning":    reasoning,
            "tags":         row.get("tags", []),
            "_hit_count":   hit_count,  # 用于排序，不输出
        })

    # 按置信度降序，取 Top-5，设置 priority
    results.sort(key=lambda x: (-x["confidence"], -x["_hit_count"]))
    for i, r in enumerate(results[:5]):
        r["priority"] = i + 1
        del r["_hit_count"]

    return results[:5]
