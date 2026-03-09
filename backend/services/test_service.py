"""检验检查服务"""
from backend.data.mock_data import MOCK_TESTS

class TestService:
    @staticmethod
    def get_recommended_tests(diagnosis: str):
        return MOCK_TESTS
