import time
from .base import Pixel, RasterResult


def rasterize_bresenham_line(x0: int, y0: int, x1: int, y1: int) -> RasterResult:
    t0 = time.perf_counter_ns()
    pixels: list[Pixel] = []
    trace_rows: list[list] = []

    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1

    err = dx - dy
    x, y = x0, y0
    step = 0

    while True:
        pixels.append(Pixel(x, y, 1.0))
        e2 = 2 * err
        if step < 40:
            trace_rows.append([step, x, y, err, e2])

        if x == x1 and y == y1:
            break

        if e2 > -dy:
            err -= dy
            x += sx
        if e2 < dx:
            err += dx
            y += sy
        step += 1

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return RasterResult(
        algorithm="bresenham_line",
        title="Алгоритм Брезенхема (отрезок)",
        pixels=pixels,
        trace_headers=["Шаг", "x", "y", "Ошибка (err)", "2·err"],
        trace_rows=trace_rows,
        elapsed_us=elapsed_us,
        description="Полностью целочисленный алгоритм без деления и чисел с плавающей точкой; направление шага определяется знаком переменной ошибки.",
    )