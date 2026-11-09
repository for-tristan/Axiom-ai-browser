"""
Tests for url_security.py — SSRF protection.
Covers tests 25–28 from the requirements.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.utils.url_security import SecurityError, validate_url, validate_redirect_url


# ── Happy path ────────────────────────────────────────────────────────────────

class TestValidUrlAccepted:
    def test_public_https_url(self):
        """A normal public HTTPS URL must pass."""
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            result = validate_url("https://example.com/page")
        assert result == "https://example.com/page"

    def test_public_http_url(self):
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            result = validate_url("http://example.com/article")
        assert result == "http://example.com/article"

    def test_url_with_path_and_query(self):
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            result = validate_url("https://news.ycombinator.com/item?id=1234")
        assert "ycombinator.com" in result


# ── SSRF — localhost ──────────────────────────────────────────────────────────

class TestLocalhostBlocked:
    """Test 25: Localhost SSRF."""

    def test_localhost_http(self):
        with pytest.raises(SecurityError):
            validate_url("http://localhost/admin")

    def test_localhost_https(self):
        with pytest.raises(SecurityError):
            validate_url("https://localhost:8080/secret")

    def test_127_0_0_1(self):
        with pytest.raises(SecurityError):
            validate_url("http://127.0.0.1/")

    def test_loopback_ipv6(self):
        with pytest.raises(SecurityError):
            validate_url("http://[::1]/")

    def test_loopback_resolves(self):
        """Hostname that resolves to loopback must be blocked."""
        with patch("app.utils.url_security._resolve_host", return_value=["127.0.0.1"]):
            with pytest.raises(SecurityError):
                validate_url("http://evil-site.com/")


# ── SSRF — private IP ────────────────────────────────────────────────────────

class TestPrivateIPBlocked:
    """Test 26: Private IP SSRF."""

    def test_rfc1918_10(self):
        with pytest.raises(SecurityError):
            validate_url("http://10.0.0.1/")

    def test_rfc1918_172(self):
        with pytest.raises(SecurityError):
            validate_url("http://172.16.0.1/")

    def test_rfc1918_192_168(self):
        with pytest.raises(SecurityError):
            validate_url("http://192.168.1.100/admin")

    def test_link_local(self):
        with pytest.raises(SecurityError):
            validate_url("http://169.254.169.254/latest/meta-data/")

    def test_resolves_to_private(self):
        """Test 26: hostname resolving to private IP is blocked."""
        with patch("app.utils.url_security._resolve_host", return_value=["10.0.0.5"]):
            with pytest.raises(SecurityError):
                validate_url("http://internal.example.com/")


# ── SSRF — redirect based ────────────────────────────────────────────────────

class TestRedirectSSRFBlocked:
    """Test 27: Redirect-based SSRF."""

    def test_redirect_to_localhost(self):
        with pytest.raises(SecurityError):
            validate_redirect_url("https://example.com", "http://localhost/admin")

    def test_redirect_to_private_ip(self):
        with pytest.raises(SecurityError):
            validate_redirect_url("https://example.com", "http://192.168.0.1/")

    def test_redirect_to_metadata(self):
        with pytest.raises(SecurityError):
            validate_redirect_url(
                "https://example.com",
                "http://169.254.169.254/latest/meta-data/"
            )


# ── SSRF — IPv6 private ──────────────────────────────────────────────────────

class TestIPv6PrivateBlocked:
    """Test 28: IPv6 private addresses."""

    def test_ipv6_loopback_bracket(self):
        with pytest.raises(SecurityError):
            validate_url("http://[::1]/")

    def test_ipv6_link_local(self):
        with pytest.raises(SecurityError):
            validate_url("http://[fe80::1]/")

    def test_ipv6_unique_local(self):
        with pytest.raises(SecurityError):
            validate_url("http://[fc00::1]/")

    def test_resolves_to_ipv6_private(self):
        with patch("app.utils.url_security._resolve_host", return_value=["::1"]):
            with pytest.raises(SecurityError):
                validate_url("http://evil.com/")


# ── Unsafe schemes ────────────────────────────────────────────────────────────

class TestUnsafeSchemes:
    def test_file_scheme(self):
        with pytest.raises(SecurityError):
            validate_url("file:///etc/passwd")

    def test_ftp_scheme(self):
        with pytest.raises(SecurityError):
            validate_url("ftp://ftp.example.com/file.txt")

    def test_javascript_scheme(self):
        with pytest.raises(SecurityError):
            validate_url("javascript:alert(1)")

    def test_data_scheme(self):
        with pytest.raises(SecurityError):
            validate_url("data:text/html,<h1>XSS</h1>")


# ── Edge cases ────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_string(self):
        with pytest.raises(SecurityError):
            validate_url("")

    def test_none_raises(self):
        with pytest.raises((SecurityError, AttributeError, TypeError)):
            validate_url(None)  # type: ignore

    def test_no_hostname(self):
        with pytest.raises(SecurityError):
            validate_url("https:///path")

    def test_cloud_metadata(self):
        with pytest.raises(SecurityError):
            validate_url("http://169.254.169.254/latest/meta-data/")
