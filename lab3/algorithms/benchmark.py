import time
from .step_by_step import rasterize_step_by_step
from .dda import rasterize_dda
from .bresenham_line import rasterize_bresenham_line
from .bresenham_circle import rasterize_bresenham_circle
from .castle_pitteway import rasterize_castle_pitteway
from .wu_antialias import rasterize_wu_line


def run_benchmark(
    x0: int, y0: int, x1: int, y1: int, xc: int, yc: int, radius: int, iterations: int = 500
) -> list[dict]:
    iterations = max(10, min(5000, int(iterations)))

    tasks = [
        ("Пошаговый алгоритм", lambda: rasterize_step_by_step(x0, y0, x1, y1)),
        ("Алгоритм ЦДА (DDA)", lambda: rasterize_dda(x0, y0, x1, y1)),
        ("Брезенхем (отрезок)", lambda: rasterize_bresenham_line(x0, y0, x1, y1)),
        ("Кастла–Питвея (доп.)", lambda: rasterize_castle_pitteway(x0, y0, x1, y1)),
        ("Алгоритм Ву (сглаж., доп.)", lambda: rasterize_wu_line(x0, y0, x1, y1)),
        ("Брезенхем (окружность)", lambda: rasterize_bresenham_circle(xc, yc, radius)),
    ]

    report = []
    for name, fn in tasks:
        # Прогрев
        sample = fn()
        px_count = len(sample.pixels)

        t_start = time.perf_counter_ns()
        for _ in range(iterations):
            fn()
        total_ns = time.perf_counter_ns() - t_start

        avg_us = (total_ns / iterations) / 1000.0
        total_ms = total_ns / 1_000_000.0
        report.append({
            "name": name,
            "pixels_count": px_count,
            "iterations": iterations,
            "avg_us": round(avg_us, 3),
            "total_ms": round(total_ms, 3),
        })

    return report