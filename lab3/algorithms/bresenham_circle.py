import time
from .base import Pixel, RasterResult


def rasterize_bresenham_circle(xc: int, yc: int, radius: int) -> RasterResult:
    t0 = time.perf_counter_ns()
    pixels: list[Pixel] = []
    trace_rows: list[list] = []
    seen: set[tuple[int, int]] = set()

    def plot8(cx: int, cy: int, x: int, y: int) -> None:
        pts = [
            (cx + x, cy + y), (cx - x, cy + y),
            (cx + x, cy - y), (cx - x, cy - y),
            (cx + y, cy + x), (cx - y, cy + x),
            (cx + y, cy - x), (cx - y, cy - x),
        ]
        for px, py in pts:
            if (px, py) not in seen:
                seen.add((px, py))
                pixels.append(Pixel(px, py, 1.0))

    r = max(0, int(radius))
    x = 0
    y = r
    d = 3 - 2 * r
    step = 0

    while y >= x:
        plot8(xc, yc, x, y)
        if step < 40:
            trace_rows.append([step, x, y, d, f"({xc + x}, {yc + y})"])

        if d < 0:
            d = d + 4 * x + 6
        else:
            d = d + 4 * (x - y) + 10
            y -= 1
        x += 1
        step += 1

    elapsed_us = (time.perf_counter_ns() - t0) / 1000.0
    return RasterResult(
        algorithm="bresenham_circle",
        title="Алгоритм Брезенхема (окружность)",
        pixels=pixels,
        trace_headers=["Шаг", "x (октант)", "y (октант)", "Параметр d", "Точка 1-го октанта"],
        trace_rows=trace_rows,
        elapsed_us=elapsed_us,
        description="Вычисляется только 1/8 окружности (от 90° до 45°) в целых числах, остальные 7 октантов строятся симметричным отображением.",
    )