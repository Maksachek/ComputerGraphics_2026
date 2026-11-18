import time
from .base import Pixel, RasterResult


def rasterize_dda(x0: int, y0: int, x1: int, y1: int) -> RasterResult:
    t0 = time.perf_counter_ns()
    pixels: list[Pixel] = []
    trace_rows: list[list] = []

    dx = x1 - x0
    dy = y1 - y0
    steps = max(abs(dx), abs(dy))

    if steps == 0:
        pixels.append(Pixel(x0, y0, 1.0))
        trace_rows.append([0, float(x0), float(y0), x0, y0])
    else:
        x_inc = dx / steps
        y_inc = dy / steps
        x = float(x0)
        y = float(y0)
        for i in range(steps + 1):
            xi = round(x)
            yi = round(y)
            pixels.append(Pixel(xi, yi, 1.0))
            if i < 40:
                trace_rows.append([i, round(x, 4), round(y, 4), xi, yi])
            x += x_inc
            y += y_inc

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return RasterResult(
        algorithm="dda",
        title="Алгоритм ЦДА (DDA)",
        pixels=pixels,
        trace_headers=["Шаг", "x (вещ.)", "y (вещ.)", "x (пикс.)", "y (пикс.)"],
        trace_rows=trace_rows,
        elapsed_us=elapsed_us,
        description="Цифровой дифференциальный анализатор: приращения dx/L и dy/L вычисляются один раз, затем накапливаются сложением.",
    )