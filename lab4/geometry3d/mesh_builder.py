import math
from typing import Any
from .glyphs import GLYPHS
from .triangulator import signed_area, merge_hole, triangulate_ear_clipping


def build_surname_mesh(raw_text: str, depth: float = 0.9) -> dict[str, Any]:
    """
    Формирует 3D-объект фамилии как явные массивы:
    positions [x, y, z...], normals [nx, ny, nz...], uvs [u, v...], indices, wire_indices.
    """
    text = (raw_text or "ИВАНОВ").strip().upper() or "ИВАНОВ"
    chars = list(text)
    spacing = 1.1
    scale = 0.22
    half_d = max(0.1, float(depth)) * 0.5

    total_w = 0.0
    for idx, ch in enumerate(chars):
        if ch == " ":
            total_w += 3.0
            continue
        g = GLYPHS.get(ch, GLYPHS["-"])
        total_w += g["w"] + (spacing if idx < len(chars) - 1 else 0.0)

    cx_offset = total_w * 0.5
    cy_offset = 4.0

    positions: list[float] = []
    normals: list[float] = []
    uvs: list[float] = []
    indices: list[int] = []
    wire_indices: list[int] = []

    def push_vertex(x: float, y: float, z: float, nx: float, ny: float, nz: float, u: float, v: float) -> int:
        idx = len(positions) // 3
        positions.extend([round(x, 5), round(y, 5), round(z, 5)])
        normals.extend([round(nx, 5), round(ny, 5), round(nz, 5)])
        uvs.extend([round(u, 5), round(v, 5)])
        return idx

    cursor_x = 0.0
    for ch in chars:
        if ch == " ":
            cursor_x += 3.0
            continue
        glyph = GLYPHS.get(ch, GLYPHS["-"])

        for shape in glyph["shapes"]:
            outer = [((cursor_x + x - cx_offset) * scale, (y - cy_offset) * scale) for x, y in shape["outer"]]
            if signed_area(outer) < 0:
                outer.reverse()

            holes = []
            for h in shape["holes"]:
                pts = [((cursor_x + x - cx_offset) * scale, (y - cy_offset) * scale) for x, y in h]
                if signed_area(pts) > 0:
                    pts.reverse()
                holes.append(pts)

            holes.sort(key=lambda pts: max(p[0] for p in pts), reverse=True)

            combined = list(outer)
            for h in holes:
                combined = merge_hole(combined, h)

            tris = triangulate_ear_clipping(combined)

            # Передняя грань (+Z)
            front_base = len(positions) // 3
            for x, y in combined:
                push_vertex(x, y, half_d, 0.0, 0.0, 1.0, x * 0.45 + 0.5, y * 0.45 + 0.5)
            for i0, i1, i2 in tris:
                indices.extend([front_base + i0, front_base + i1, front_base + i2])

            # Задняя грань (-Z)
            back_base = len(positions) // 3
            for x, y in combined:
                push_vertex(x, y, -half_d, 0.0, 0.0, -1.0, x * 0.45 + 0.5, y * 0.45 + 0.5)
            for i0, i1, i2 in tris:
                indices.extend([back_base + i0, back_base + i2, back_base + i1])

            # Боковые грани выдавливания
            for contour in [outer, *holes]:
                m = len(contour)
                perim = 0.0
                for i in range(m):
                    p1 = contour[i]
                    p2 = contour[(i + 1) % m]
                    dx = p2[0] - p1[0]
                    dy = p2[1] - p1[1]
                    seg_len = math.hypot(dx, dy) or 1.0
                    nx, ny = dy / seg_len, -dx / seg_len

                    u0 = perim * 0.6
                    u1 = (perim + seg_len) * 0.6
                    perim += seg_len

                    v00 = push_vertex(p1[0], p1[1], half_d, nx, ny, 0.0, u0, 1.0)
                    v01 = push_vertex(p1[0], p1[1], -half_d, nx, ny, 0.0, u0, 0.0)
                    v11 = push_vertex(p2[0], p2[1], -half_d, nx, ny, 0.0, u1, 0.0)
                    v10 = push_vertex(p2[0], p2[1], half_d, nx, ny, 0.0, u1, 1.0)
                    indices.extend([v00, v01, v11, v00, v11, v10])

        cursor_x += glyph["w"] + spacing

    for i in range(0, len(indices), 3):
        a, b, c = indices[i], indices[i + 1], indices[i + 2]
        wire_indices.extend([a, b, b, c, c, a])

    v_count = len(positions) // 3
    preview = []
    for i in range(min(100, v_count)):
        preview.append({
            "index": i,
            "x": round(positions[i * 3], 3),
            "y": round(positions[i * 3 + 1], 3),
            "z": round(positions[i * 3 + 2], 3),
            "u": round(uvs[i * 2], 3),
            "v": round(uvs[i * 2 + 1], 3),
        })

    return {
        "positions": positions,
        "normals": normals,
        "uvs": uvs,
        "indices": indices,
        "wire_indices": wire_indices,
        "vertex_count": v_count,
        "triangle_count": len(indices) // 3,
        "vertices_preview": preview,
    }