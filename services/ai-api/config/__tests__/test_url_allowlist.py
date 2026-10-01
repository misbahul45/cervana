from unittest.mock import patch

import pytest

from config.url_allowlist import UrlAllowList, assert_url_allowed


def test_https_allowlisted_when_scheme_permitted():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    assert al.is_allowed("https://cdn.example.com/file.pdf")
    assert al.is_allowed("HTTPS://CDN.example.com/file.pdf")


def test_http_blocked_when_only_https_allowed():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    assert not al.is_allowed("http://cdn.example.com/file.pdf")


def test_unknown_host_blocked():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    assert not al.is_allowed("https://attacker.com/file.pdf")


def test_no_scheme_blocked():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    assert not al.is_allowed("cdn.example.com/file.pdf")
    assert not al.is_allowed("javascript:alert(1)")


def test_invalid_url_blocked():
    al = UrlAllowList(allowed_hosts=["cdn.example.com"], allowed_schemes=["https"])
    assert not al.is_allowed("not a url")


def test_loopback_ip_blocked_by_default():
    al = UrlAllowList(allowed_hosts=["cdn.example.com"], allowed_schemes=["https"])
    assert not al.is_allowed("http://127.0.0.1:8000/internal")
    assert not al.is_allowed("http://localhost/admin")


def test_loopback_ip_allowed_when_explicit():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https", "http"],
        allow_local=True,
    )
    assert al.is_allowed("http://127.0.0.1:8000/internal")
    assert al.is_allowed("http://localhost/dev")
    assert not al.is_allowed("http://10.0.0.5/private")


def test_private_ip_blocked_even_when_local_allowed():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https", "http"],
        allow_local=True,
    )
    assert not al.is_allowed("http://10.0.0.5/admin")
    assert not al.is_allowed("http://192.168.1.1/admin")


def test_empty_hostname_blocked():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    assert not al.is_allowed("https:///path")


def test_subdomain_does_not_match():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    assert not al.is_allowed("https://evil.cdn.example.com/file.pdf")


def test_assert_url_allowed_raises_on_blocked():
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https"],
    )
    with patch("config.url_allowlist._default_allowlist", al):
        with pytest.raises(ValueError, match="not allowed"):
            assert_url_allowed("https://attacker.com/x")
        # does not raise
        assert_url_allowed("https://cdn.example.com/x")


def test_env_driven_allowlist_parses_csv():
    al = UrlAllowList(
        allowed_hosts="a.example.com,b.example.com,c.example.com".split(","),
        allowed_schemes="https,http".split(","),
    )
    assert al.is_allowed("https://a.example.com/x")
    assert al.is_allowed("http://b.example.com/x")
    assert not al.is_allowed("https://d.example.com/x")


def test_ip_literal_recognition_in_string_split(monkeypatch):
    al = UrlAllowList(
        allowed_hosts=["cdn.example.com"],
        allowed_schemes=["https", "http"],
        allow_local=True,
    )
    assert not al._is_ip_literal("cdn.example.com")
    assert al._is_ip_literal("192.168.1.1")
    assert al._is_ip_literal("::1")
    assert not al._is_ip_literal("not.an.ip")

def test_cloud_metadata_and_private_ranges_are_never_reachable():
    for allow_local in (True, False):
        al = UrlAllowList(
            allowed_hosts=["cdn.example.com"],
            allowed_schemes=["https", "http"],
            allow_local=allow_local,
        )
        for url in (
            "http://169.254.169.254/latest/meta-data/",
            "http://10.1.2.3/",
            "http://192.168.0.10/",
            "http://172.16.5.5/",
            "http://[::ffff:10.0.0.5]/",
            "http://[fd00::1]/",
            "http://8.8.8.8/",
        ):
            assert not al.is_allowed(url), url
