"""
Shared pytest fixtures and configuration.
"""

from __future__ import annotations

import pytest


# ── HTML fixtures ─────────────────────────────────────────────────────────────

ARTICLE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="description" content="A deep dive into Python programming.">
  <meta name="author" content="Jane Doe">
  <meta property="article:published_time" content="2024-01-15T10:00:00Z">
  <title>Python Programming Guide - TechBlog</title>
  <link rel="canonical" href="https://example.com/python-guide">
</head>
<body>
  <nav><ul><li><a href="/">Home</a></li></ul></nav>
  <header><h1>TechBlog</h1></header>
  <main>
    <article>
      <h1>Python Programming Guide</h1>
      <p>Python is a high-level, general-purpose programming language known for
      its readability and clean syntax. It was created by Guido van Rossum and
      first released in 1991.</p>

      <h2>Key Features</h2>
      <ul>
        <li>Simple and readable syntax</li>
        <li>Large standard library</li>
        <li>Dynamic typing</li>
        <li>Interpreted language</li>
      </ul>

      <h2>Data Structures</h2>
      <p>Python provides built-in data structures such as lists, tuples,
      dictionaries, and sets. These structures allow efficient data
      manipulation and storage.</p>

      <table>
        <tr><th>Structure</th><th>Mutable</th></tr>
        <tr><td>List</td><td>Yes</td></tr>
        <tr><td>Tuple</td><td>No</td></tr>
        <tr><td>Dict</td><td>Yes</td></tr>
      </table>
    </article>
  </main>
  <footer><p>© 2024 TechBlog</p></footer>
  <script>console.log("tracking");</script>
</body>
</html>"""


EMPTY_HTML = """<!DOCTYPE html>
<html><head><title>Empty</title></head>
<body><p></p></body>
</html>"""


MALFORMED_HTML = """<html><head><title>Malformed
<body>
  <p>Some text without closing tags
  <div>Nested <span>content</div>
  <p>More text
"""


LIST_HTML = """<!DOCTYPE html>
<html lang="en">
<head><title>List Article</title></head>
<body>
<main>
<h1>Top 5 Programming Languages</h1>
<p>Here are the most popular programming languages in 2024:</p>
<ol>
  <li>Python — widely used in data science and web development</li>
  <li>JavaScript — essential for web frontend development</li>
  <li>Java — popular in enterprise applications</li>
  <li>C++ — used in systems and game development</li>
  <li>Rust — growing in systems programming for memory safety</li>
</ol>
<p>These languages have large communities and excellent job markets.</p>
</main>
</body>
</html>"""


TABLE_HTML = """<!DOCTYPE html>
<html lang="en">
<head><title>Table Article</title></head>
<body>
<main>
<h1>Comparison of Web Frameworks</h1>
<p>A comparison of popular Python web frameworks:</p>
<table>
  <thead>
    <tr><th>Framework</th><th>Language</th><th>Use Case</th></tr>
  </thead>
  <tbody>
    <tr><td>Django</td><td>Python</td><td>Full-stack web apps</td></tr>
    <tr><td>FastAPI</td><td>Python</td><td>High-performance APIs</td></tr>
    <tr><td>Flask</td><td>Python</td><td>Lightweight microservices</td></tr>
  </tbody>
</table>
</main>
</body>
</html>"""
