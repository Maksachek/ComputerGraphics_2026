import math
import time
from .models import Segment, ClipWindow

INSIDE = 0
LEFT = 1
RIGHT = 2
BOTTOM = 4
TOP = 8


def compute_outcode(x: float, y: float, w: ClipWindow) -> int:
    code = INSIDE
    if x < w.xmin:
        code |= LEFT
    elif x > w.xmax:
        code |= RIGHT
    if y < w.ymin:
        code |= BOTTOM
    elif y > w.ymax:
        code |= TOP
    return code


def _clip_single_midpoint(
    x1: float, y1: float, x2: float, y2: float,
    w: ClipWindow, eps: float = 1e-4, max_depth: int = 32
) -> dict:
    subdivisions = 0
    midpoints: list[list[float]] = []

    def recurse(ax: float, ay: float, bx: float, by: float, depth: int):
        nonlocal subdivisions
        c1 = compute_outcode(ax, ay, w)
        c2 = compute_outcode(bx, by, w)

        # Тривиально видим
        if (c1 | c2) == 0:
            return (ax, ay, bx, by)

        # Тривиально невидим
        if (c1 & c2) != 0:
            return None

        # Достигнута точность eps или предел глубины
        if math.hypot(bx - ax, by - ay) < eps or depth >= max_depth:
            mx = (ax + bx) * 0.5
            my = (ay + by) * 0.5
            if (w.xmin - eps <= mx <= w.xmax + eps) and (w.ymin - eps <= my <= w.ymax + eps):
                return (mx, my, mx, my)
            return None

        # Деление отрезка пополам (средняя точка)
        subdivisions += 1
        mx = (ax + bx) * 0.5
        my = (ay + by) * 0.5
        if len(midpoints) < 60:
            midpoints.append([round(mx, 3), round(my, 3)])

        left_res = recurse(ax, ay, mx, my, depth + 1)
        right_res = recurse(mx, my, bx, by, depth + 1)

        if left_res is not None and right_res is not None:
            return (left_res[0], left_res[1], right_res[2], right_res[3])
        if left_res is not None:
            return left_res
        if right_res is not None:
            return right_res
        return None

    c_start = compute_outcode(x1, y1, w)
    c_end = compute_outcode(x2, y2, w)
    clipped = recurse(x1, y1, x2, y2, 0)

    if clipped is None:
        status = "Невидим"
        visible = None
    elif subdivisions == 0:
        status = "Полностью видим"
        visible = [round(clipped[0], 3), round(clipped[1], 3), round(clipped[2], 3), round(clipped[3], 3)]
    else:
        status = "Частично видим"
        visible = [round(clipped[0], 3), round(clipped[1], 3), round(clipped[2], 3), round(clipped[3], 3)]

    return {
        "orig": [x1, y1, x2, y2],
        "clipped": visible,
        "code1": f"{c_start:04b}",
        "code2": f"{c_end:04b}",
        "subdivisions": subdivisions,
        "midpoints": midpoints,
        "status": status,
    }


def clip_segments_midpoint(segments: list[Segment], window: ClipWindow, eps: float = 1e-4) -> dict:
    t0 = time.perf_counter_ns()
    results = [_clip_single_midpoint(s.x1, s.y1, s.x2, s.y2, window, eps) for s in segments]
    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return {
        "window": {"xmin": window.xmin, "ymin": window.ymin, "xmax": window.xmax, "ymax": window.ymax},
        "items": results,
        "elapsed_us": round(elapsed_us, 3),
    }