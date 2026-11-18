import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from geometry3d import build_surname_mesh, compute_model_matrix

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


class AppRequestHandler(BaseHTTPRequestHandler):
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
            self._send_json({"error": "Invalid JSON"}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/mesh":
            surname = str(data.get("surname", "ИВАНОВ"))
            depth = float(data.get("depth", 0.9))
            mesh = build_surname_mesh(surname, depth)
            self._send_json(mesh)

        elif path == "/api/transform":
            res = compute_model_matrix(
                tx=float(data.get("tx", 0.0)),
                ty=float(data.get("ty", 0.0)),
                tz=float(data.get("tz", 0.0)),
                rx=float(data.get("rx", 0.0)),
                ry=float(data.get("ry", 0.0)),
                rz=float(data.get("rz", 0.0)),
                sx=float(data.get("sx", 1.0)),
                sy=float(data.get("sy", 1.0)),
                sz=float(data.get("sz", 1.0)),
                order=str(data.get("order", "TRS")),
            )
            self._send_json(res)

        else:
            self._send_json({"error": "Unknown endpoint"}, HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args) -> None:
        pass


def run_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), AppRequestHandler)