import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from clipping import (
    parse_segments_text,
    parse_polygon_text,
    clip_segments_midpoint,
    clip_polygon_sutherland_hodgman,
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


class ClipRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"

        target = (STATIC_DIR / path.lstrip("/")).resolve()
        if not target.is_file() or STATIC_DIR not in target.parents:
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        content = target.read_bytes()
        mime = MIME_TYPES.get(target.suffix, "application/octet-stream")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            data = self._read_json()
        except json.JSONDecodeError:
            self._send_json({"error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
            return

        try:
            if path == "/api/clip-segments":
                segments, window = parse_segments_text(str(data.get("text", "")))
                eps = float(data.get("eps", 1e-4))
                self._send_json(clip_segments_midpoint(segments, window, eps))

            elif path == "/api/clip-polygon":
                poly, window = parse_polygon_text(str(data.get("text", "")))
                self._send_json(clip_polygon_sutherland_hodgman(poly, window))

            else:
                self._send_json({"error": "Неизвестный маршрут"}, HTTPStatus.NOT_FOUND)
        except ValueError as err:
            self._send_json({"error": str(err)}, HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args) -> None:
        pass


def run_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), ClipRequestHandler)