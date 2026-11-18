import math
from typing import Any


def mat4_identity() -> list[list[float]]:
    return [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_multiply(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    out = [[0.0] * 4 for _ in range(4)]
    for i in range(4):
        for j in range(4):
            out[i][j] = (
                a[i][0] * b[0][j]
                + a[i][1] * b[1][j]
                + a[i][2] * b[2][j]
                + a[i][3] * b[3][j]
            )
    return out


def mat4_translate(tx: float, ty: float, tz: float) -> list[list[float]]:
    return [
        [1.0, 0.0, 0.0, tx],
        [0.0, 1.0, 0.0, ty],
        [0.0, 0.0, 1.0, tz],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_scale(sx: float, sy: float, sz: float) -> list[list[float]]:
    return [
        [sx, 0.0, 0.0, 0.0],
        [0.0, sy, 0.0, 0.0],
        [0.0, 0.0, sz, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_rotate_x(deg: float) -> list[list[float]]:
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, c, -s, 0.0],
        [0.0, s, c, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_rotate_y(deg: float) -> list[list[float]]:
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return [
        [c, 0.0, s, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [-s, 0.0, c, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat4_rotate_z(deg: float) -> list[list[float]]:
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return [
        [c, -s, 0.0, 0.0],
        [s, c, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def to_column_major_flat(m: list[list[float]]) -> list[float]:
    """Преобразование строчной матрицы 4x4 в столбцовый массив для WebGL."""
    flat: list[float] = []
    for col in range(4):
        for row in range(4):
            flat.append(round(m[row][col], 6))
    return flat


def compute_model_matrix(
    tx: float, ty: float, tz: float,
    rx: float, ry: float, rz: float,
    sx: float, sy: float, sz: float,
    order: str = "TRS",
) -> dict[str, Any]:
    T = mat4_translate(tx, ty, tz)
    Rx = mat4_rotate_x(rx)
    Ry = mat4_rotate_y(ry)
    Rz = mat4_rotate_z(rz)
    S = mat4_scale(sx, sy, sz)

    R = mat4_multiply(Rz, mat4_multiply(Ry, Rx))

    if order == "TRS":
        M = mat4_multiply(T, mat4_multiply(R, S))
        formula = "v' = M · v   (M = T · Rz · Ry · Rx · S)"
    elif order == "RTS":
        M = mat4_multiply(R, mat4_multiply(T, S))
        formula = "v' = M · v   (M = Rz · Ry · Rx · T · S)"
    else:
        M = mat4_multiply(S, mat4_multiply(R, T))
        formula = "v' = M · v   (M = S · Rz · Ry · Rx · T)"

    return {
        "matrix_row_major": [[round(v, 4) for v in row] for row in M],
        "matrix_col_major": to_column_major_flat(M),
        "formula": formula,
    }