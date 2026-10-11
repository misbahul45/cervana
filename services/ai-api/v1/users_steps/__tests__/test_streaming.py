from __future__ import annotations

from types import SimpleNamespace

from v1.users_steps.streaming import chunk_text


def test_plain_string_chunk_is_returned_untouched():
    assert chunk_text("Akuntansi") == "Akuntansi"


def test_leading_and_trailing_spaces_survive():
    assert chunk_text(" Akuntansi ") == " Akuntansi "


def test_whitespace_only_chunk_is_kept():
    assert chunk_text(" ") == " "
    assert chunk_text("\n\n") == "\n\n"


def test_joined_chunks_rebuild_the_original_sentence():
    pieces = ["Apa It", "u", " Akuntansi?", " —", " Pand", "uan", "\n\n", "**Lang", "kah 1**"]

    assert "".join(chunk_text(piece) for piece in pieces) == "Apa Itu Akuntansi? — Panduan\n\n**Langkah 1**"


def test_empty_chunk_is_skipped():
    assert chunk_text("") is None
    assert chunk_text(None) is None


def test_delta_text_and_content_attributes_are_read_in_order():
    assert chunk_text(SimpleNamespace(delta=" a", text="b", content="c")) == " a"
    assert chunk_text(SimpleNamespace(delta="", text=" b", content="c")) == " b"
    assert chunk_text(SimpleNamespace(delta="", text="", content=" c")) == " c"


def test_callable_text_is_resolved():
    assert chunk_text(SimpleNamespace(text=lambda: " d")) == " d"


def test_non_string_chunk_is_stringified():
    assert chunk_text(42) == "42"
