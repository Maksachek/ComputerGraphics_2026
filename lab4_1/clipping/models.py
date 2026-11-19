import re
from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float


@dataclass
class Segment:
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass
class ClipWindow:
    xmin: float
    ymin: float
    xmax: float
    ymax: float

    @classmethod
    def normalized(cls, x1: float, y1: float, x2: float, y2: float) -> "ClipWindow":
        return cls(min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))


def _clean_lines(raw_text: str) -> list[list[float]]:
    """Извлекает числа из строк, игнорируя пустые строки и комментарии (*...*, #...)."""
    rows: list[list[float]] = []
    for line in raw_text.splitlines():
        line = re.sub(r"\*.*?\*", "", line)
        line = line.split("#")[0].strip()
        if not line:
            continue
        nums = [float(tok) for tok in line.replace(",", " ").split()]
        if nums:
            rows.append(nums)
    return rows


def parse_segments_text(raw_text: str) -> tuple[list[Segment], ClipWindow]:
    """
    Формат из задания:
    n
    X1_1 Y1_1 X2_1 Y2_1
    ...
    X1_n Y1_n X2_n Y2_n
    Xmin Ymin Xmax Ymax
    """
    rows = _clean_lines(raw_text)
    if len(rows) < 2:
        raise ValueError("Недостаточно строк во входных данных.")

    n = int(rows[0][0])
    if len(rows) < n + 2:
        raise ValueError(f"Ожидалось {n} отрезков и строка окна, получено строк: {len(rows) - 1}.")

    segments: list[Segment] = []
    for i in range(1, n + 1):
        if len(rows[i]) < 4:
            raise ValueError(f"Строка отрезка #{i} должна содержать 4 координаты.")
        x1, y1, x2, y2 = rows[i][:4]
        segments.append(Segment(x1, y1, x2, y2))

    win_row = rows[n + 1]
    if len(win_row) < 4:
        raise ValueError("Последняя строка окна должна содержать 4 числа: Xmin Ymin Xmax Ymax.")
    window = ClipWindow.normalized(win_row[0], win_row[1], win_row[2], win_row[3])
    return segments, window


def parse_polygon_text(raw_text: str) -> tuple[list[Point], ClipWindow]:
    """
    Формат для выпуклого многоугольника:
    m (число вершин)
    X_1 Y_1
    ...
    X_m Y_m
    Xmin Ymin Xmax Ymax
    """
    rows = _clean_lines(raw_text)
    if len(rows) < 4:
        raise ValueError("Недостаточно данных для многоугольника и окна.")

    m = int(rows[0][0])
    if len(rows) < m + 2:
        raise ValueError(f"Ожидалось {m} вершин и строка окна.")

    poly: list[Point] = []
    for i in range(1, m + 1):
        if len(rows[i]) < 2:
            raise ValueError(f"Строка вершины #{i} должна содержать X и Y.")
        poly.append(Point(rows[i][0], rows[i][1]))

    win_row = rows[m + 1]
    if len(win_row) < 4:
        raise ValueError("Последняя строка окна должна содержать 4 числа: Xmin Ymin Xmax Ymax.")
    window = ClipWindow.normalized(win_row[0], win_row[1], win_row[2], win_row[3])
    return poly, window