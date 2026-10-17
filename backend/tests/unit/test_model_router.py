import pytest

from app.services.llm.contracts import AIWorkload
from app.services.llm.router import ModelRouter


class FakeProvider:
    def __init__(self, name: str) -> None:
        self.provider_name = name
        self.model_name = name


@pytest.fixture
def router() -> ModelRouter:
    return ModelRouter(
        rag_provider=FakeProvider("rag"),
        code_provider=FakeProvider("code"),
    )


def test_rag_usa_openvino(router: ModelRouter) -> None:
    assert router.resolve(AIWorkload.CORPORATE_RAG).provider_name == "rag"


def test_narrativa_usa_openvino(router: ModelRouter) -> None:
    assert router.resolve(AIWorkload.NARRATIVE).provider_name == "rag"


def test_codigo_usa_ollama(router: ModelRouter) -> None:
    assert router.resolve(AIWorkload.CODE_ASSIST).provider_name == "code"


def test_deterministico_nao_chama_llm(router: ModelRouter) -> None:
    with pytest.raises(ValueError, match="engines do backend"):
        router.resolve(AIWorkload.DETERMINISTIC)
