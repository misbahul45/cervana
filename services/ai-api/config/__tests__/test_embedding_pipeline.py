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

    pipeline = EmbeddingPipeline(enable_retrieval=False)

    assert pipeline.retrieve("query") == []


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


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_retrieve_passes_no_filter_when_metadata_filter_is_none():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline()
    pipeline.index.as_retriever = MagicMock()

    pipeline.retrieve("query")

    kwargs = pipeline.index.as_retriever.call_args.kwargs
    assert kwargs["filters"] is None


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_retrieve_builds_filter_for_metadata():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline()
    pipeline.index.as_retriever = MagicMock()

    pipeline.retrieve("query", metadata_filter={"source": "material"}, top_k=5)

    kwargs = pipeline.index.as_retriever.call_args.kwargs
    assert kwargs["similarity_top_k"] == 5
    assert kwargs["filters"] is not None


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.build_embedding_model", new=MagicMock())
@patch("config.embedding_pipeline.build_chat_model", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_retrieve_handles_compound_metadata_filter():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline()
    pipeline.index.as_retriever = MagicMock()

    pipeline.retrieve(
        "query",
        metadata_filter={"tenantId": "t1", "publicationStatus": {"eq": "PUBLISHED"}},
        top_k=10,
    )

    kwargs = pipeline.index.as_retriever.call_args.kwargs
    assert kwargs["similarity_top_k"] == 10
    assert kwargs["filters"] is not None
