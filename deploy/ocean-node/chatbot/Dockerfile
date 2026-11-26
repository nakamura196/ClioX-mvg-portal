# Image for the chatbot (server.py is mounted, not copied, so edits need only a
# restart). The anthropic package is used only when BACKEND=anthropic; with
# BACKEND=ollama the server runs on the standard library alone.
# anthropic pinned to a release at least a week old (1.7.0, 2026-09-18).
FROM python:3.12-slim@sha256:f77ac9e44ae96ef2c90b8053ea08c31f8be030f824196b0ae4db6d462c84e51f
RUN pip install --no-cache-dir anthropic==1.7.0
