from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class Pixel:
    x: int
    y: int
    alpha: float = 1.0  # Интенсивность [0.0 .. 1.0], для сглаживания


@dataclass
class RasterResult:
    algorithm: str
    title: str
    pixels: list[Pixel]
    trace_headers: list[str]
    trace_rows: list[list[Any]]
    elapsed_us: float
    description: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "algorithm": self.algorithm,
            "title": self.title,
            "pixels": [asdict(p) for p in self.pixels],
            "trace_headers": self.trace_headers,
            "trace_rows": self.trace_rows,
            "elapsed_us": round(self.elapsed_us, 3),
            "description": self.description,
        }