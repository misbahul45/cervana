from unittest.mock import patch, MagicMock


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.GeminiEmbedding", new=MagicMock())
@patch("config.embedding_pipeline.ChatGoogleGenerativeAI", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_default_translation_disabled():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline()

    assert pipeline.enable_translation is False


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.GeminiEmbedding", new=MagicMock())
@patch("config.embedding_pipeline.ChatGoogleGenerativeAI", new=MagicMock())
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
@patch("config.embedding_pipeline.GeminiEmbedding", new=MagicMock())
@patch("config.embedding_pipeline.ChatGoogleGenerativeAI", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_translate_short_circuits_when_disabled():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline(enable_translation=False)

    assert pipeline.translate("hello world") == "hello world"


@patch("config.embedding_pipeline.VectorStoreIndex", new=MagicMock())
@patch("config.embedding_pipeline.QdrantVectorStore", new=MagicMock())
@patch("config.embedding_pipeline.GeminiEmbedding", new=MagicMock())
@patch("config.embedding_pipeline.ChatGoogleGenerativeAI", new=MagicMock())
@patch("config.embedding_pipeline.SemanticSplitterNodeParser", new=MagicMock())
@patch("config.embedding_pipeline.SentenceSplitter", new=MagicMock())
def test_retrieve_returns_empty_when_disabled():
    from config.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline(enable_retrieval=False)

    assert pipeline.retrieve("query") == []