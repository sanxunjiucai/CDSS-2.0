"""搜索服务"""
from backend.data.mock_data import SEARCH_CATEGORIES, MOCK_SEARCH_RESULTS

class SearchService:
    @staticmethod
    def get_categories():
        return SEARCH_CATEGORIES

    @staticmethod
    def search(keyword: str, category: str = "综合"):
        return MOCK_SEARCH_RESULTS.get(keyword, [])
