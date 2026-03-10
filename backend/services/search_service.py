"""搜索服务"""
from backend.data.repositories.knowledge_repo import search_knowledge, get_all_knowledge

_CATEGORIES = ["全部", "指南", "药物", "疾病", "检验"]


class SearchService:
    @staticmethod
    def get_categories() -> list[str]:
        return _CATEGORIES

    @staticmethod
    def search(keyword: str, category: str = "全部") -> list[dict]:
        if not keyword or not keyword.strip():
            return get_all_knowledge(limit=10)
        # 映射前端分类名 → DB type 字段
        type_map = {"药物": "药物", "疾病": "疾病", "检验": "检验", "指南": "指南"}
        db_type = type_map.get(category, "")
        results = search_knowledge(keyword.strip(), db_type)
        # 格式化为前端期望的结构
        return [
            {
                "id":        str(r["id"]),
                "type":      r["type"],
                "title":     r["title"],
                "summary":   r["summary"],
                "content":   r["content"],
                "tags":      r["tags"],
                "source":    r["source"],
                "updatedAt": r["updated_at"],
            }
            for r in results
        ]
