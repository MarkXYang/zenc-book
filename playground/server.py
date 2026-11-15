#!/usr/bin/env python3
"""Minimal HTTP playground runner for The Zen C Programming Language mdBook."""

import argparse
import json
import os
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_CODE_BYTES = 64 * 1024
MAX_OUTPUT_CHARS = 32 * 1024
RUN_TIMEOUT_SECS = 10


def truncate_output(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + "\n... [output truncated]"


class PlaygroundHandler(BaseHTTPRequestHandler):
    server_version = "ZenCPlayground/1.0"

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/run":
            self._send_json(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"ok": False, "stderr": "Invalid Content-Length"})
            return

        if length <= 0 or length > MAX_CODE_BYTES:
            self._send_json(
                400,
                {"ok": False, "stderr": f"Payload must be 1..{MAX_CODE_BYTES} bytes"},
            )
            return

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as exc:
            self._send_json(400, {"ok": False, "stderr": f"Invalid JSON: {exc}"})
            return

        code = data.get("code", "")
        mode = data.get("mode", "run")
        if not isinstance(code, str) or not code.strip():
            self._send_json(400, {"ok": False, "stderr": "Missing 'code' string"})
            return
        if mode not in ("run", "test"):
            mode = "run"

        start = time.monotonic()
        with tempfile.TemporaryDirectory(prefix="zenc_pg_") as tmpdir:
            src_path = os.path.join(tmpdir, "main.zc")
            with open(src_path, "w", encoding="utf-8") as fh:
                fh.write(code)

            cmd = ["zc", mode, "-q", src_path]
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=tmpdir,
                    capture_output=True,
                    text=True,
                    timeout=RUN_TIMEOUT_SECS,
                )
                elapsed_ms = int((time.monotonic() - start) * 1000)
                self._send_json(
                    200,
                    {
                        "ok": proc.returncode == 0,
                        "exit_code": proc.returncode,
                        "stdout": truncate_output(proc.stdout),
                        "stderr": truncate_output(proc.stderr),
                        "elapsed_ms": elapsed_ms,
                    },
                )
            except subprocess.TimeoutExpired:
                elapsed_ms = int((time.monotonic() - start) * 1000)
                self._send_json(
                    200,
                    {
                        "ok": False,
                        "exit_code": -1,
                        "stdout": "",
                        "stderr": f"Execution timed out after {RUN_TIMEOUT_SECS}s",
                        "elapsed_ms": elapsed_ms,
                    },
                )
            except FileNotFoundError:
                self._send_json(
                    500,
                    {
                        "ok": False,
                        "exit_code": -1,
                        "stdout": "",
                        "stderr": "'zc' compiler not found in PATH on playground server",
                    },
                )

    def log_message(self, format, *args):
        return


def main():
    parser = argparse.ArgumentParser(description="Zen C Book Playground Server")
    parser.add_argument("--host", default=os.environ.get("ZENC_PLAYGROUND_HOST", "127.0.0.1"))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("ZENC_PLAYGROUND_PORT", "8787"))
    )
    args = parser.parse_args()

    httpd = ThreadingHTTPServer((args.host, args.port), PlaygroundHandler)
    print(f"Zen C Playground listening on http://{args.host}:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.server_close()


if __name__ == "__main__":
    main()
