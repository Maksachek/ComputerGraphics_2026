import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from algorithms import (
    rasterize_step_by_step,
    rasterize_dda,
    rasterize_bresenham_line,
    rasterize_bresenham_circle,
    rasterize_castle_pitteway,
    rasterize_wu_line,
    run_benchmark,
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


class RasterRequestHandler(BaseHTTPRequestHandler):
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
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
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

        if path == "/api/rasterize":
            algo = data.get("algorithm", "bresenham_line")
            x0 = int(data.get("x0", 0))
            y0 = int(data.get("y0", 0))
            x1 = int(data.get("x1", 11))
            y1 = int(data.get("y1", 4))
            xc = int(data.get("xc", 0))
            yc = int(data.get("yc", 0))
            r = int(data.get("r", 8))

            dispatch = {
                "step": lambda: rasterize_step_by_step(x0, y0, x1, y1),
                "dda": lambda: rasterize_dda(x0, y0, x1, y1),
                "bresenham_line": lambda: rasterize_bresenham_line(x0, y0, x1, y1),
                "castle_pitteway": lambda: rasterize_castle_pitteway(x0, y0, x1, y1),
                "wu": lambda: rasterize_wu_line(x0, y0, x1, y1),
                "bresenham_circle": lambda: rasterize_bresenham_circle(xc, yc, r),
            }
            runner = dispatch.get(algo)
            if runner is None:
                self._send_json({"error": "Неизвестный алгоритм"}, HTTPStatus.BAD_REQUEST)
                return

            result = runner()
            self._send_json(result.to_dict())

        elif path == "/api/benchmark":
            res = run_benchmark(
                x0=int(data.get("x0", 0)),
                y0=int(data.get("y0", 0)),
                x1=int(data.get("x1", 40)),
                y1=int(data.get("y1", 17)),
                xc=int(data.get("xc", 0)),
                yc=int(data.get("yc", 0)),
                radius=int(data.get("r", 20)),
                iterations=int(data.get("iterations", 500)),
            )
            self._send_json({"results": res})
        else:
            self._send_json({"error": "Неизвестный маршрут"}, HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args) -> None:
        # Тихий лог в консоль
        pass


def run_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), RasterRequestHandler)