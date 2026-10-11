from unittest.mock import patch, MagicMock


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_default_translation_disabled():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline()

    assert pipeline.enable_translation is False


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_explicit_translation_flag_respected():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline(enable_translation=True)
    assert pipeline.enable_translation is True

    pipeline_off = EmbeddingPipeline(enable_translation=False)
    assert pipeline_off.enable_translation is False


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_translate_short_circuits_when_disabled():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline(enable_translation=False)

    assert pipeline.translate("hello world") == "hello world"


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_retrieve_returns_empty_when_disabled():
    from config.embedding_pipeline import EmbeddingPipeline
    from config.retrieval_governance import RetrievalScope

    pipeline = EmbeddingPipeline(enable_retrieval=False)

    assert pipeline.retrieve("query", scope=RetrievalScope("u-1", "ACCOUNTING")) == []


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_llm_prompt_uses_thinking_model_only_when_thinking_is_enabled():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline(enable_thinking=True)
    pipeline.llm = MagicMock()
    pipeline.llm_thinking = MagicMock()
    pipeline.llm_thinking.invoke.return_value.content = " deep "
    pipeline.llm.invoke.return_value.content = " fast "

    assert pipeline.llm_prompt("q") == "deep"

    pipeline.enable_thinking = False
    assert pipeline.llm_prompt("q") == "fast"


import logging

import pytest
from qdrant_client.models import Filter

from config.retrieval_governance import Governance, GovernanceError, RetrievalScope, build_qdrant_filter


def _pipeline():
    from config.embedding_pipeline import EmbeddingPipeline

    return EmbeddingPipeline()


def _hit(chunk_id, score=0.9, text="isi", **extra):
    return MagicMock(score=score, node=MagicMock(text=text, metadata={"chunk_id": chunk_id, **extra}))


def _retriever(*batches):
    queue = list(batches)
    retriever = MagicMock()
    retriever.retrieve.side_effect = lambda query: queue.pop(0)
    return retriever


_PATCHES = [
    patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock()),
    patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock()),
    patch("config.embedding_pipeline.build_embedding_model", new=MagicMock()),
    patch("config.embedding_pipeline.build_chat_model", new=MagicMock()),
    patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock()),
    patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock()),
]


@pytest.fixture(autouse=True)
def _heavy_collaborators():
    for p in _PATCHES:
        p.start()
    yield
    for p in _PATCHES:
        p.stop()


SCOPE = RetrievalScope("u-1", "ACCOUNTING")


def test_a_retrieval_without_a_scope_is_refused_before_the_store_is_touched():
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock()

    with pytest.raises(TypeError):
        pipeline.retrieve("query")
    with pytest.raises(GovernanceError):
        pipeline.retrieve("query", scope=None)

    pipeline.index.as_retriever.assert_not_called()


def test_the_scope_filter_reaches_the_store_as_a_native_qdrant_filter_and_not_as_a_llamaindex_filter():
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock(return_value=_retriever([_hit("a:0")]))

    pipeline.retrieve("query", scope=SCOPE, top_k=5)

    kwargs = pipeline.index.as_retriever.call_args.kwargs
    assert kwargs["similarity_top_k"] == 5
    assert kwargs.get("filters") is None
    sent = kwargs["vector_store_kwargs"]["qdrant_filters"]
    assert isinstance(sent, Filter)
    assert sent.model_dump(exclude_none=True) == build_qdrant_filter(SCOPE).model_dump(exclude_none=True)


def test_a_scope_without_concepts_runs_one_search_and_returns_text_score_and_metadata():
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock(return_value=_retriever([_hit("a:0", 0.8, "teks", concept_ids=["c1"])]))

    results = pipeline.retrieve("query", scope=SCOPE)

    assert pipeline.index.as_retriever.call_count == 1
    assert results == [{"score": 0.8, "text": "teks", "metadata": {"chunk_id": "a:0", "concept_ids": ["c1"]}}]


def test_enough_concept_hits_make_the_second_search_unnecessary():
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock(return_value=_retriever([_hit("a:0"), _hit("b:0"), _hit("c:0")]))

    results = pipeline.retrieve("query", scope=RetrievalScope("u-1", "ACCOUNTING", concept_ids=("c1",)), top_k=10)

    assert pipeline.index.as_retriever.call_count == 1
    assert [r["metadata"]["chunk_id"] for r in results] == ["a:0", "b:0", "c:0"]
    sent = pipeline.index.as_retriever.call_args.kwargs["vector_store_kwargs"]["qdrant_filters"].model_dump(exclude_none=True)
    assert {"key": "concept_ids", "match": {"any": ["c1"]}} in sent["must"]


def test_few_concept_hits_are_topped_up_with_domain_wide_hits_without_repeats_and_concept_hits_first():
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock(
        side_effect=[_retriever([_hit("a:0")]), _retriever([_hit("a:0"), _hit("b:0"), _hit("c:0"), _hit("d:0")])]
    )

    results = pipeline.retrieve("query", scope=RetrievalScope("u-1", "ACCOUNTING", concept_ids=("c1",)), top_k=3)

    assert [r["metadata"]["chunk_id"] for r in results] == ["a:0", "b:0", "c:0"]
    first, second = (c.kwargs["vector_store_kwargs"]["qdrant_filters"].model_dump(exclude_none=True) for c in pipeline.index.as_retriever.call_args_list)
    assert len(first["must"]) == 4 and len(second["must"]) == 3


def test_the_second_search_never_widens_the_access_rule():
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock(side_effect=[_retriever([]), _retriever([])])

    pipeline.retrieve("query", scope=RetrievalScope("u-1", "ACCOUNTING", concept_ids=("c1",)))

    for call in pipeline.index.as_retriever.call_args_list:
        must = call.kwargs["vector_store_kwargs"]["qdrant_filters"].model_dump(exclude_none=True)["must"]
        assert must[0] == {"key": "status", "match": {"value": "PUBLISHED"}}
        assert must[2]["should"][1]["must"][1] == {"key": "owner_id", "match": {"value": "u-1"}}


def test_the_retrieval_log_names_ids_and_never_the_query_or_the_text(caplog):
    pipeline = _pipeline()
    pipeline.index.as_retriever = MagicMock(return_value=_retriever([_hit("a:0", text="RAHASIA ISI CHUNK")]))

    with caplog.at_level(logging.INFO, logger="embedding_pipeline"):
        pipeline.retrieve("pertanyaan rahasia pelajar", scope=SCOPE)

    logged = " ".join(r.getMessage() for r in caplog.records)
    assert "a:0" in logged and "u-1" in logged and "ACCOUNTING" in logged
    assert "RAHASIA" not in logged and "pertanyaan" not in logged


GOVERNANCE = Governance(doc_kind="concept-outline", domain_id="ACCOUNTING", status="PUBLISHED", access_scope="PLATFORM", concept_ids=("c1",))


def _upsert(pipeline, metadata=None, governance=GOVERNANCE):
    import config.embedding_pipeline as module

    pipeline.smart_chunker = MagicMock(chunk=MagicMock(return_value=["satu", "dua"]))
    pipeline.upsert_document("isi dokumen", "golden:c1", metadata=metadata, governance=governance)
    return module.VectorStoreIndex.from_documents.call_args.args[0]


def test_a_write_without_governance_is_refused_before_anything_is_embedded():
    pipeline = _pipeline()
    pipeline.smart_chunker = MagicMock()

    with pytest.raises(TypeError):
        pipeline.upsert_document("isi", "golden:c1", metadata={})
    with pytest.raises(GovernanceError):
        pipeline.upsert_document("isi", "golden:c1", metadata={}, governance=None)

    pipeline.smart_chunker.chunk.assert_not_called()


def test_every_chunk_carries_the_governance_keys_and_its_own_chunk_id():
    nodes = _upsert(_pipeline(), metadata={"source_kind": "golden-graph"})

    assert [n.metadata["chunk_id"] for n in nodes] == ["golden:c1:0", "golden:c1:1"]
    for node in nodes:
        assert node.metadata["status"] == "PUBLISHED" and node.metadata["access_scope"] == "PLATFORM"
        assert node.metadata["concept_ids"] == ["c1"] and node.metadata["schema_version"] == 1
        assert node.metadata["source_kind"] == "golden-graph" and node.metadata["source"] == "golden:c1"


def test_a_caller_cannot_override_a_governance_key_through_the_free_metadata():
    nodes = _upsert(_pipeline(), metadata={"status": "DRAFT", "access_scope": "OWNER", "owner_id": "u-9", "concept_ids": ["evil"], "chunk_id": "x"})

    assert nodes[0].metadata["status"] == "PUBLISHED"
    assert nodes[0].metadata["access_scope"] == "PLATFORM"
    assert "owner_id" not in nodes[0].metadata
    assert nodes[0].metadata["concept_ids"] == ["c1"]
    assert nodes[0].metadata["chunk_id"] == "golden:c1:0"


def test_a_failure_of_the_embedding_or_the_store_surfaces_as_a_retrieval_error_not_a_raw_exception():
    from errors.types import RetrievalError

    pipeline = _pipeline()
    retriever = MagicMock()
    retriever.retrieve.side_effect = RuntimeError("HF embedding request failed with 402")
    pipeline.index.as_retriever = MagicMock(return_value=retriever)

    with pytest.raises(RetrievalError) as caught:
        pipeline.retrieve("query", scope=SCOPE)

    assert "402" not in caught.value.message
    assert caught.value.details == {"reason": "RuntimeError"}


def test_a_governance_error_is_not_turned_into_a_retrieval_error():
    pipeline = _pipeline()

    with pytest.raises(GovernanceError):
        pipeline.retrieve("query", scope="u-1")
