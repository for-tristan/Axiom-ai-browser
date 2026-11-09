"""
URL security validation — SSRF protection layer.

This module validates every URL *before* we make an outgoing HTTP request.
It guards against:

* Unsafe URL schemes (file://, ftp://, etc.)
* Localhost and loopback addresses
* Private IPv4 and IPv6 ranges (RFC 1918, RFC 4193, link-local)
* Cloud metadata endpoints (169.254.169.254, etc.)
* DNS rebinding: we resolve the hostname and re-check the IP
* Redirect chains: each redirect destination is re-validated

We use Python's standard ``socket`` and ``ipaddress`` modules so there
are no additional dependencies.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


# ── Constants ─────────────────────────────────────────────────────────────────

ALLOWED_SCHEMES = {"http", "https"}

# Private / reserved IPv4 networks (RFC 1918, loopback, link-local, metadata)
_PRIVATE_V4 = [
    ipaddress.IPv4Network("0.0.0.0/8"),
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("100.64.0.0/10"),
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("169.254.0.0/16"),   # link-local / AWS metadata
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.0.0.0/24"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("198.18.0.0/15"),
    ipaddress.IPv4Network("198.51.100.0/24"),
    ipaddress.IPv4Network("203.0.113.0/24"),
    ipaddress.IPv4Network("240.0.0.0/4"),
    ipaddress.IPv4Network("255.255.255.255/32"),
]

_PRIVATE_V6 = [
    ipaddress.IPv6Network("::1/128"),          # loopback
    ipaddress.IPv6Network("fc00::/7"),         # unique local
    ipaddress.IPv6Network("fe80::/10"),        # link-local
    ipaddress.IPv6Network("::ffff:0:0/96"),    # IPv4-mapped
    ipaddress.IPv6Network("64:ff9b::/96"),     # IPv4/IPv6 translation
    ipaddress.IPv6Network("100::/64"),         # discard
    ipaddress.IPv6Network("2001:db8::/32"),    # documentation
    ipaddress.IPv6Network("2002::/16"),        # 6to4
]

# Well-known cloud metadata IPs
_METADATA_IPS = {
    "169.254.169.254",   # AWS / GCP / Azure instance metadata
    "169.254.170.2",     # AWS ECS metadata
    "fd00:ec2::254",     # AWS IPv6 metadata
    "metadata.google.internal",
}


# ── Exceptions ────────────────────────────────────────────────────────────────

class SecurityError(Exception):
    """Raised when a URL is rejected for security reasons."""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_private_ip(addr: str) -> bool:
    """Return True if the resolved IP is in a private / reserved range."""
    # Direct string match for known metadata hostnames
    if addr in _METADATA_IPS:
        return True
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False

    if isinstance(ip, ipaddress.IPv4Address):
        return any(ip in net for net in _PRIVATE_V4)
    # IPv6
    return any(ip in net for net in _PRIVATE_V6)


def _resolve_host(hostname: str) -> list[str]:
    """
    Resolve a hostname to all its IP addresses.
    Returns a list of IP strings (may be empty on resolution failure).
    """
    try:
        results = socket.getaddrinfo(hostname, None)
        return [r[4][0] for r in results]
    except socket.gaierror:
        return []


# ── Public API ────────────────────────────────────────────────────────────────

def validate_url(url: str) -> str:
    """
    Validate a URL for SSRF safety.

    Returns the sanitized URL string if safe.
    Raises SecurityError with a human-readable reason if not.
    """
    if not url or not isinstance(url, str):
        raise SecurityError("URL must be a non-empty string.")

    url = url.strip()

    # 1. Parse
    try:
        parsed = urlparse(url)
    except Exception as exc:
        raise SecurityError(f"Malformed URL: {exc}") from exc

    # 2. Scheme check
    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise SecurityError(
            f"URL scheme '{scheme}' is not allowed. Only http and https are permitted."
        )

    # 3. Hostname must be present
    hostname = parsed.hostname
    if not hostname:
        raise SecurityError("URL must contain a valid hostname.")

    # 4. Direct metadata hostname check
    if hostname in _METADATA_IPS or hostname == "metadata.google.internal":
        raise SecurityError(f"Access to metadata endpoint '{hostname}' is blocked.")

    # 5. Reject numeric IPs that are private immediately (avoid DNS round-trip)
    try:
        ip_obj = ipaddress.ip_address(hostname)
        if _is_private_ip(str(ip_obj)):
            raise SecurityError(
                f"Direct IP access to private/reserved address '{hostname}' is blocked."
            )
    except ValueError:
        pass  # It's a hostname, not a raw IP — DNS check below

    # 6. DNS resolution + IP validation (prevents DNS rebinding to some extent)
    resolved_ips = _resolve_host(hostname)
    if not resolved_ips:
        # Can't resolve — block it (fail-safe)
        raise SecurityError(f"Could not resolve hostname '{hostname}'.")

    for ip in resolved_ips:
        if _is_private_ip(ip):
            raise SecurityError(
                f"Hostname '{hostname}' resolves to private/reserved IP '{ip}'. "
                "SSRF protection blocked this request."
            )

    return url


def validate_redirect_url(original_url: str, redirect_url: str) -> str:
    """
    Validate a redirect destination.
    Every hop in a redirect chain must pass the same security checks.
    """
    try:
        return validate_url(redirect_url)
    except SecurityError as exc:
        raise SecurityError(
            f"Redirect from '{original_url}' to '{redirect_url}' was blocked: {exc}"
        ) from exc
