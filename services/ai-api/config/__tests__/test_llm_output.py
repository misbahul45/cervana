from __future__ import annotations

from pydantic import BaseModel

from config.llm_output import json_validator, parse_json_object, strip_code_fence


class Strict(BaseModel):
    strengths: list[str]


class TestStripCodeFence:
    def test_plain_text_is_unchanged(self):
        assert strip_code_fence('{"a": 1}') == '{"a": 1}'

    def test_a_json_fence_is_removed(self):
        assert strip_code_fence('```json\n{"a": 1}\n```') == '{"a": 1}'

    def test_a_bare_fence_is_removed(self):
        assert strip_code_fence('```\n{"a": 1}\n```') == '{"a": 1}'

    def test_surrounding_whitespace_is_trimmed(self):
        assert strip_code_fence('  \n```json\n[1]\n```\n ') == "[1]"


class TestParseJsonObject:
    def test_parses_a_fenced_object(self):
        assert parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}

    def test_rejects_a_non_object(self):
        for text in ("[1, 2]", '"x"', "3", "null"):
            try:
                parse_json_object(text)
            except ValueError:
                continue
            raise AssertionError(f"{text} should be rejected")

    def test_rejects_invalid_json(self):
        try:
            parse_json_object("{broken")
        except ValueError:
            return
        raise AssertionError("invalid json should be rejected")


class TestJsonValidator:
    def test_accepts_parsable_objects(self):
        assert json_validator()('{"a": 1}') is True

    def test_rejects_prose(self):
        assert json_validator()("Berikut hasilnya: ...") is False

    def test_validates_against_a_pydantic_model(self):
        validator = json_validator(Strict)

        assert validator('{"strengths": ["rajin"]}') is True
        assert validator('{"strengths": "rajin"}') is False
        assert validator("{}") is False
