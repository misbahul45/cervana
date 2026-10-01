from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams


def ensure_collection(client: QdrantClient, name: str, dimensions: int) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dimensions, distance=Distance.COSINE),
        )
        return

    vectors = client.get_collection(name).config.params.vectors
    size = getattr(vectors, "size", None)
    if size is not None and size != dimensions:
        raise RuntimeError(
            f"Qdrant collection '{name}' has vector size {size} but EMBEDDING_DIM is "
            f"{dimensions}; point the collection setting at a new name and re-embed"
        )
