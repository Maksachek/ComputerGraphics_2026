import math
import time
from .base import Pixel, RasterResult


def rasterize_wu_line(x0: int, y0: int, x1: int, y1: int) -> RasterResult:
    """
    Алгоритм Сяолиня Ву (Xiaolin Wu) для построения сглаженных (anti-aliased) отрезков.
    На каждом шаге закрашивает пару соседних пикселей с весами (1 - frac) и frac.
    """
    t0 = time.perf_counter_ns()
    pixels: list[Pixel] = []
    trace_rows: list[list] = []

    if x0 == x1 and y0 == y1:
        pixels.append(Pixel(x0, y0, 1.0))
        trace_rows.append([x0, y0, 1.0, "—", 0.0])
    else:
        steep = abs(y1 - y0) > abs(x1 - x0)
        px0, py0, px1, py1 = x0, y0, x1, y1
        if steep:
            px0, py0 = py0, px0
            px1, py1 = py1, px1
        if px0 > px1:
            px0, px1 = px1, px0
            py0, py1 = py1, py0

        dx = px1 - px0
        dy = py1 - py0
        gradient = dy / dx if dx != 0 else 1.0

        def add_pt(u: int, v: int, alpha: float) -> None:
            if alpha <= 1e-4:
                return
            if steep:
                pixels.append(Pixel(v, u, round(alpha, 4)))
            else:
                pixels.append(Pixel(u, v, round(alpha, 4)))

        # Начальная точка
        add_pt(px0, py0, 1.0)
        trace_rows.append([px0, py0, 1.0, py0 + 1, 0.0])

        intery = py0 + gradient
        for idx, x in enumerate(range(px0 + 1, px1)):
            y_base = math.floor(intery)
            frac = intery - y_base
            a1 = 1.0 - frac
            a2 = frac
            add_pt(x, y_base, a1)
            add_pt(x, y_base + 1, a2)
            if idx < 38:
                trace_rows.append([x, y_base, round(a1, 3), y_base + 1, round(a2, 3)])
            intery += gradient

        # Конечная точка
        add_pt(px1, py1, 1.0)
        if len(trace_rows) < 40:
            trace_rows.append([px1, py1, 1.0, py1 + 1, 0.0])

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return RasterResult(
        algorithm="wu",
        title="Сглаженная линия (алгоритм Ву)",
        pixels=pixels,
        trace_headers=["Главная ось", "Пиксел 1", "Яркость 1", "Пиксел 2", "Яркость 2"],
        trace_rows=trace_rows,
        elapsed_us=elapsed_us,
        description="Антиалиасинг: в каждом столбце закрашиваются два соседних пикселя с интенсивностями (1 - {y}) и {y}, устраняя 'лестничный эффект'.",
    )