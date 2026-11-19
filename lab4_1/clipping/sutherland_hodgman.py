import time
from .models import Point, ClipWindow


def is_convex_polygon(pts: list[Point]) -> bool:
    """Проверка выпуклости многоугольника по знаку векторных произведений."""
    n = len(pts)
    if n < 3:
        return False
    sign = 0
    for i in range(n):
        a = pts[i]
        b = pts[(i + 1) % n]
        c = pts[(i + 2) % n]
        cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
        if abs(cross) > 1e-9:
            cur_sign = 1 if cross > 0 else -1
            if sign == 0:
                sign = cur_sign
            elif sign != cur_sign:
                return False
    return sign != 0


def _clip_against_edge(pts: list[Point], edge: str, w: ClipWindow) -> list[Point]:
    if not pts:
        return []

    def inside(p: Point) -> bool:
        if edge == "left":
            return p.x >= w.xmin
        if edge == "right":
            return p.x <= w.xmax
        if edge == "bottom":
            return p.y >= w.ymin
        return p.y <= w.ymax  # top

    def intersect(s: Point, e: Point) -> Point:
        dx = e.x - s.x
        dy = e.y - s.y
        if edge == "left":
            t = (w.xmin - s.x) / dx if abs(dx) > 1e-12 else 0.0
            return Point(w.xmin, s.y + t * dy)
        if edge == "right":
            t = (w.xmax - s.x) / dx if abs(dx) > 1e-12 else 0.0
            return Point(w.xmax, s.y + t * dy)
        if edge == "bottom":
            t = (w.ymin - s.y) / dy if abs(dy) > 1e-12 else 0.0
            return Point(s.x + t * dx, w.ymin)
        # top
        t = (w.ymax - s.y) / dy if abs(dy) > 1e-12 else 0.0
        return Point(s.x + t * dx, w.ymax)

    out: list[Point] = []
    n = len(pts)
    for i in range(n):
        s = pts[i]
        e = pts[(i + 1) % n]
        s_in = inside(s)
        e_in = inside(e)

        if s_in and e_in:
            out.append(e)
        elif s_in and not e_in:
            out.append(intersect(s, e))
        elif not s_in and e_in:
            out.append(intersect(s, e))
            out.append(e)

    # Удаляем случайные совпадающие подряд вершины
    cleaned: list[Point] = []
    for p in out:
        if not cleaned or abs(cleaned[-1].x - p.x) > 1e-9 or abs(cleaned[-1].y - p.y) > 1e-9:
            cleaned.append(p)
    if len(cleaned) > 1 and abs(cleaned[0].x - cleaned[-1].x) < 1e-9 and abs(cleaned[0].y - cleaned[-1].y) < 1e-9:
        cleaned.pop()
    return cleaned


def clip_polygon_sutherland_hodgman(poly: list[Point], window: ClipWindow) -> dict:
    t0 = time.perf_counter_ns()
    stages = []
    current = list(poly)

    edge_names = [
        ("left", f"x >= {window.xmin}"),
        ("right", f"x <= {window.xmax}"),
        ("bottom", f"y >= {window.ymin}"),
        ("top", f"y <= {window.ymax}"),
    ]

    for edge_key, label in edge_names:
        current = _clip_against_edge(current, edge_key, window)
        stages.append({
            "edge": label,
            "vertex_count": len(current),
            "vertices": [[round(p.x, 3), round(p.y, 3)] for p in current],
        })

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return {
        "window": {"xmin": window.xmin, "ymin": window.ymin, "xmax": window.xmax, "ymax": window.ymax},
        "orig_polygon": [[p.x, p.y] for p in poly],
        "clipped_polygon": [[round(p.x, 3), round(p.y, 3)] for p in current],
        "is_convex": is_convex_polygon(poly),
        "stages": stages,
        "elapsed_us": round(elapsed_us, 3),
    }