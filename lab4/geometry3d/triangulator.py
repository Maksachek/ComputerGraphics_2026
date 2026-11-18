import math

Point2D = tuple[float, float]


def same_point(a: Point2D, b: Point2D, eps: float = 1e-9) -> bool:
    return abs(a[0] - b[0]) < eps and abs(a[1] - b[1]) < eps


def signed_area(poly: list[Point2D]) -> float:
    area = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return 0.5 * area


def cross2(a: Point2D, b: Point2D, c: Point2D) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def point_in_triangle_any_order(p: Point2D, a: Point2D, b: Point2D, c: Point2D) -> bool:
    # Игнорируем совпадающие по координатам вершины (дубликаты на мостах отверстий)
    if same_point(p, a) or same_point(p, b) or same_point(p, c):
        return False
    c1 = cross2(a, b, p)
    c2 = cross2(b, c, p)
    c3 = cross2(c, a, p)
    has_neg = (c1 < -1e-9) or (c2 < -1e-9) or (c3 < -1e-9)
    has_pos = (c1 > 1e-9) or (c2 > 1e-9) or (c3 > 1e-9)
    return not (has_neg and has_pos)


def merge_hole(outer: list[Point2D], hole: list[Point2D]) -> list[Point2D]:
    """Соединяет внутреннее отверстие с внешним контуром невидимым мостом (алгоритм Эберли)."""
    m_idx = max(range(len(hole)), key=lambda i: hole[i][0])
    M = hole[m_idx]

    best_x = float("inf")
    best_edge = -1
    n = len(outer)

    for i in range(n):
        A = outer[i]
        B = outer[(i + 1) % n]
        if (A[1] <= M[1] < B[1]) or (B[1] <= M[1] < A[1]):
            ix = A[0] + (M[1] - A[1]) * (B[0] - A[0]) / (B[1] - A[1])
            if ix >= M[0] - 1e-9 and ix < best_x:
                best_x = ix
                best_edge = i

    if best_edge == -1:
        return outer

    A = outer[best_edge]
    B = outer[(best_edge + 1) % n]
    p_idx = best_edge if A[0] >= B[0] else (best_edge + 1) % n
    P = outer[p_idx]
    I = (best_x, M[1])

    best_angle = float("inf")
    for i in range(n):
        if i == p_idx:
            continue
        R = outer[i]
        if R[0] >= M[0] and point_in_triangle_any_order(R, M, I, P):
            ang = abs(math.atan2(R[1] - M[1], R[0] - M[0]))
            if ang < best_angle:
                best_angle = ang
                p_idx = i

    merged: list[Point2D] = []
    merged.extend(outer[: p_idx + 1])
    for k in range(len(hole)):
        merged.append(hole[(m_idx + k) % len(hole)])
    merged.append(hole[m_idx])
    merged.append(outer[p_idx])
    merged.extend(outer[p_idx + 1 :])
    return merged


def triangulate_ear_clipping(poly: list[Point2D]) -> list[tuple[int, int, int]]:
    """Триангуляция простого полигона (против часовой стрелки) методом отрезания ушей."""
    n = len(poly)
    if n < 3:
        return []

    idx_list = list(range(n))
    tris: list[tuple[int, int, int]] = []
    guard = 0

    while len(idx_list) > 3 and guard < 3000:
        guard += 1
        ear_found = False
        m = len(idx_list)

        # Удаляем вырожденные "шипы" (A -> B -> A), если они остались после свёртывания моста
        spike_removed = False
        for i in range(m):
            prev_i = idx_list[(i - 1) % m]
            next_i = idx_list[(i + 1) % m]
            if same_point(poly[prev_i], poly[next_i]):
                idx_list.pop(i)
                spike_removed = True
                break
        if spike_removed:
            continue

        for i in range(m):
            prev_i = idx_list[(i - 1) % m]
            curr_i = idx_list[i]
            next_i = idx_list[(i + 1) % m]
            a, b, c = poly[prev_i], poly[curr_i], poly[next_i]

            if cross2(a, b, c) <= 1e-10:
                continue

            inside = False
            for j in range(m):
                test_i = idx_list[j]
                if test_i in (prev_i, curr_i, next_i):
                    continue
                if point_in_triangle_any_order(poly[test_i], a, b, c):
                    inside = True
                    break

            if not inside:
                tris.append((prev_i, curr_i, next_i))
                idx_list.pop(i)
                ear_found = True
                break

        if not ear_found:
            break

    if len(idx_list) == 3:
        a, b, c = poly[idx_list[0]], poly[idx_list[1]], poly[idx_list[2]]
        if abs(cross2(a, b, c)) > 1e-10:
            tris.append((idx_list[0], idx_list[1], idx_list[2]))

    return tris