"""检验检查服务"""
from backend.data.repositories.knowledge_repo import get_tests


class TestService:
    @staticmethod
    def get_recommended_tests(diagnosis: str) -> list[dict]:
        return get_tests(diagnosis)
