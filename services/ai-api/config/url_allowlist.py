"""
URL allow-list for Resource extraction.

Prevents SSRF and RAG-poisoning by restricting which URLs the
AI service may fetch when extracting PDFs / transcripts.

Configurable via env:
  RESOURCE_ALLOWLIST_HOSTS=cdn.reducera.example.com,docs.reducera.example.com
  RESOURCE_ALLOWLIST_SCHEMES=https
  RESOURCE_ALLOWLIST_LOCAL=true|false    (allow 127.0.0.1 / localhost for dev)
"""

import ipaddress
from typing import Iterable
from urllib.parse import urlparse

from config.envs import ENVS

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _parse_hosts(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {h.strip().lower() for h in raw.split(",") if h.strip()}


def _parse_schemes(raw: str | None) -> set[str]:
    if not raw:
        return {"https"}
    return {s.strip().lower() for s in raw.split(",") if s.strip()}


class UrlAllowList:
    def __init__(
        self,
        allowed_hosts: Iterable[str] | None = None,
        allowed_schemes: Iterable[str] | None = None,
        allow_local: bool = False,
    ):
        if allowed_hosts is None:
            allowed_hosts = _parse_hosts(ENVS.get("RESOURCE_ALLOWLIST_HOSTS"))
        if allowed_schemes is None:
            allowed_schemes = _parse_schemes(ENVS.get("RESOURCE_ALLOWLIST_SCHEMES"))
        self.allowed_hosts = {h.lower() for h in allowed_hosts}
        self.allowed_schemes = {s.lower() for s in allowed_schemes}
        self.allow_local = allow_local or (
            str(ENVS.get("RESOURCE_ALLOWLIST_LOCAL", "")).lower() in {"1", "true", "yes"}
        )

    def is_allowed(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
        except ValueError:
            return False

        scheme = (parsed.scheme or "").lower()
        if scheme not in self.allowed_schemes:
            return False

        host = (parsed.hostname or "").lower()

        if self.allow_local and host in LOCAL_HOSTS:
            return True

        if not host:
            return False

        if host in self.allowed_hosts:
            return True

        if self._is_ip_literal(host):
            try:
                ip = ipaddress.ip_address(host)
            except ValueError:
                return False
            if ip.is_loopback:
                return self.allow_local
            return False

        return False

    @staticmethod
    def _is_ip_literal(host: str) -> bool:
        try:
            ipaddress.ip_address(host)
            return True
        except ValueError:
            return False


_default_allowlist: UrlAllowList | None = None


def get_default_allowlist() -> UrlAllowList:
    global _default_allowlist
    if _default_allowlist is None:
        _default_allowlist = UrlAllowList()
    return _default_allowlist


def assert_url_allowed(url: str) -> None:
    """Raise ValueError if url is not on the allow-list."""
    if not get_default_allowlist().is_allowed(url):
        raise ValueError(f"URL not allowed by allow-list: {url}")