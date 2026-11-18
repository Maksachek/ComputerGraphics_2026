import time
from .base import Pixel, RasterResult


def rasterize_castle_pitteway(x0: int, y0: int, x1: int, y1: int) -> RasterResult:
    """
    Алгоритм Кастла–Питвея (структурная растеризация прямой через алгоритм Евклида).
    Строит последовательность шагов: 's' (осевой по главной оси) и 'd' (диагональный).
    """
    t0 = time.perf_counter_ns()
    pixels: list[Pixel] = []
    trace_rows: list[list] = []

    dx = x1 - x0
    dy = y1 - y0
    abs_dx = abs(dx)
    abs_dy = abs(dy)
    sx = 1 if dx >= 0 else -1
    sy = 1 if dy >= 0 else -1

    steep = abs_dy > abs_dx
    a, b = (abs_dy, abs_dx) if steep else (abs_dx, abs_dy)

    if a == 0:
        pixels.append(Pixel(x0, y0, 1.0))
        trace_rows.append([0, 0, 0, "—", "—"])
    else:
        if b == 0:
            pattern = "s" * a
            trace_rows.append([0, a, 0, "s", "—"])
        elif a == b:
            pattern = "d" * a
            trace_rows.append([0, 0, b, "—", "d"])
        else:
            x = a - b
            y = b
            m1 = "s"
            m2 = "d"
            step = 0
            trace_rows.append([step, x, y, m1, m2])

            while x != y:
                step += 1
                if x > y:
                    x -= y
                    m2 = m1 + m2
                else:
                    y -= x
                    m1 = m2 + m1
                if step < 30:
                    trace_rows.append([step, x, y, m1[:24], m2[:24]])

            # x == y == НОД(a, b): повторяем итоговый блок (m2 + m1) ровно x раз
            pattern = (m2 + m1) * x

        # Воспроизведение координат по построенной строке шагов
        cx, cy = x0, y0
        pixels.append(Pixel(cx, cy, 1.0))
        for move in pattern:
            if not steep:
                cx += sx
                if move == "d":
                    cy += sy
            else:
                cy += sy
                if move == "d":
                    cx += sx
            pixels.append(Pixel(cx, cy, 1.0))

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return RasterResult(
        algorithm="castle_pitteway",
        title="Алгоритм Кастла–Питвея",
        pixels=pixels,
        trace_headers=["Итер.", "x (ост. s)", "y (ост. d)", "m1 (база s)", "m2 (база d)"],
        trace_rows=trace_rows,
        elapsed_us=elapsed_us,
        description="Структурный алгоритм на основе вычитания Евклида: формирует строку осевых ('s') и диагональных ('d') шагов до равенства x == y.",
    )