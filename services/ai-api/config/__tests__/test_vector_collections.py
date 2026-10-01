from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from config.vector_collections import ensure_collection


def client_with(existing, size=None):
    client = MagicMock()
    client.get_collections.return_value = SimpleNamespace(
        collections=[SimpleNamespace(name=name) for name in existing]
    )
    client.get_collection.return_value = SimpleNamespace(
        config=SimpleNamespace(params=SimpleNamespace(vectors=SimpleNamespace(size=size)))
    )
    return client


def test_missing_collection_is_created_with_configured_size():
    client = client_with([])
    ensure_collection(client, "docs", 1024)

    assert client.create_collection.call_args.kwargs["vectors_config"].size == 1024


def test_matching_collection_is_left_alone():
    client = client_with(["docs"], size=1024)
    ensure_collection(client, "docs", 1024)

    client.create_collection.assert_not_called()


def test_size_mismatch_fails_loudly():
    client = client_with(["docs"], size=768)

    with pytest.raises(RuntimeError, match="768"):
        ensure_collection(client, "docs", 1024)

    client.create_collection.assert_not_called()
