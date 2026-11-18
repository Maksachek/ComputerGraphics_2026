import time
from .base import Pixel, RasterResult


def rasterize_step_by_step(x0: int, y0: int, x1: int, y1: int) -> RasterResult:
    t0 = time.perf_counter_ns()
    pixels: list[Pixel] = []
    trace_rows: list[list] = []

    dx = x1 - x0
    dy = y1 - y0

    if dx == 0 and dy == 0:
        pixels.append(Pixel(x0, y0, 1.0))
        trace_rows.append([0, x0, y0, x0, y0])
    elif abs(dx) >= abs(dy):
        k = dy / dx
        b = y0 - k * x0
        step = 1 if x1 >= x0 else -1
        for idx, x in enumerate(range(x0, x1 + step, step)):
            y_exact = k * x + b
            y_int = round(y_exact)
            pixels.append(Pixel(x, y_int, 1.0))
            if idx < 40:
                trace_rows.append([idx, x, round(y_exact, 4), x, y_int])
    else:
        inv_k = dx / dy
        step = 1 if y1 >= y0 else -1
        for idx, y in enumerate(range(y0, y1 + step, step)):
            x_exact = x0 + inv_k * (y - y0)
            x_int = round(x_exact)
            pixels.append(Pixel(x_int, y, 1.0))
            if idx < 40:
                trace_rows.append([idx, round(x_exact, 4), y, x_int, y])

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return RasterResult(
        algorithm="step",
        title="Пошаговый алгоритм",
        pixels=pixels,
        trace_headers=["Шаг", "x (выч.)", "y (выч.)", "x (пикс.)", "y (пикс.)"],
        trace_rows=trace_rows,
        elapsed_us=elapsed_us,
        description="Вычисление координаты по уравнению прямой y = kx + b (или x = x0 + (y - y0)/k при |dy| > |dx|) с округлением на каждом шаге.",
    )