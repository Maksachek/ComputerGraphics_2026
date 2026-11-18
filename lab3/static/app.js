const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

const state = {
  cellSize: 32,
  offsetX: 0,
  offsetY: 0,
  pixels: [],
  algorithm: "bresenham_line",
  dragging: false,
  dragMoved: false,
  lastMouseX: 0,
  lastMouseY: 0,
  clickStage: 0,
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(300, Math.floor(rect.width));
  canvas.height = Math.max(250, Math.floor(rect.height));
  if (state.offsetX === 0 && state.offsetY === 0) {
    centerOrigin();
  }
  drawScene();
}

function centerOrigin() {
  state.offsetX = Math.floor(canvas.width * 0.35);
  state.offsetY = Math.floor(canvas.height * 0.65);
}

// Преобразование координат сетки (x, y) <-> экранные координаты (sx, sy)
function gridToScreen(gx, gy) {
  return {
    sx: state.offsetX + gx * state.cellSize,
    sy: state.offsetY - gy * state.cellSize,
  };
}

function screenToGrid(sx, sy) {
  return {
    gx: Math.floor((sx - state.offsetX) / state.cellSize),
    gy: Math.floor((state.offsetY - sy) / state.cellSize),
  };
}

function drawScene() {
  const w = canvas.width;
  const h = canvas.height;
  const cs = state.cellSize;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  const minGx = Math.floor(-state.offsetX / cs) - 1;
  const maxGx = Math.ceil((w - state.offsetX) / cs) + 1;
  const minGy = Math.floor((state.offsetY - h) / cs) - 1;
  const maxGy = Math.ceil(state.offsetY / cs) + 1;

  // 1. Закрашенные пиксели (дискретные ячейки [x, x+1] × [y, y+1])
  for (const p of state.pixels) {
    const { sx, sy } = gridToScreen(p.x, p.y + 1);
    const alpha = p.alpha ?? 1.0;
    ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.fillRect(sx, sy, cs, cs);
  }

  // 2. Линии дискретной сетки
  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = minGx; gx <= maxGx; gx++) {
    const sx = state.offsetX + gx * cs;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let gy = minGy; gy <= maxGy; gy++) {
    const sy = state.offsetY - gy * cs;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();

  // 3. Оси координат X и Y
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Ось X (y = 0)
  ctx.moveTo(0, state.offsetY);
  ctx.lineTo(w, state.offsetY);
  // Ось Y (x = 0)
  ctx.moveTo(state.offsetX, 0);
  ctx.lineTo(state.offsetX, h);
  ctx.stroke();

  // 4. Подписи делений осей
  const stepTick = cs >= 28 ? 1 : cs >= 16 ? 2 : 5;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px ui-monospace, monospace";

  for (let gx = minGx; gx <= maxGx; gx++) {
    if (gx % stepTick !== 0) continue;
    const sx = state.offsetX + gx * cs;
    ctx.fillText(String(gx), sx + 3, Math.min(h - 6, Math.max(14, state.offsetY + 13)));
  }
  for (let gy = minGy; gy <= maxGy; gy++) {
    if (gy === 0 || gy % stepTick !== 0) continue;
    const sy = state.offsetY - gy * cs;
    ctx.fillText(String(gy), Math.min(w - 28, Math.max(4, state.offsetX + 5)), sy - 3);
  }

  // Названия осей
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("X", w - 18, Math.min(h - 10, Math.max(16, state.offsetY - 8)));
  ctx.fillText("Y", Math.min(w - 20, Math.max(8, state.offsetX + 10)), 16);

  // 5. Идеальная математическая линия / окружность через центры ячеек (x+0.5, y+0.5)
  if (document.getElementById("showIdeal").checked) {
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();

    if (state.algorithm === "bresenham_circle") {
      const xc = parseInt(document.getElementById("xc").value, 10) || 0;
      const yc = parseInt(document.getElementById("yc").value, 10) || 0;
      const r = Math.max(0, parseInt(document.getElementById("radius").value, 10) || 0);
      const center = gridToScreen(xc + 0.5, yc + 0.5);
      ctx.arc(center.sx, center.sy, r * cs, 0, Math.PI * 2);
    } else {
      const x0 = parseInt(document.getElementById("x0").value, 10) || 0;
      const y0 = parseInt(document.getElementById("y0").value, 10) || 0;
      const x1 = parseInt(document.getElementById("x1").value, 10) || 0;
      const y1 = parseInt(document.getElementById("y1").value, 10) || 0;
      const p0 = gridToScreen(x0 + 0.5, y0 + 0.5);
      const p1 = gridToScreen(x1 + 0.5, y1 + 0.5);
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
    }
    ctx.stroke();
    ctx.restore();
  }
}

async function requestRasterize() {
  state.algorithm = document.getElementById("algoSelect").value;
  const isCircle = state.algorithm === "bresenham_circle";
  document.getElementById("lineInputs").style.display = isCircle ? "none" : "grid";
  document.getElementById("circleInputs").style.display = isCircle ? "grid" : "none";

  const payload = {
    algorithm: state.algorithm,
    x0: parseInt(document.getElementById("x0").value, 10) || 0,
    y0: parseInt(document.getElementById("y0").value, 10) || 0,
    x1: parseInt(document.getElementById("x1").value, 10) || 0,
    y1: parseInt(document.getElementById("y1").value, 10) || 0,
    xc: parseInt(document.getElementById("xc").value, 10) || 0,
    yc: parseInt(document.getElementById("yc").value, 10) || 0,
    r: parseInt(document.getElementById("radius").value, 10) || 0,
  };

  const resp = await fetch("/api/rasterize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();

  state.pixels = data.pixels || [];
  document.getElementById("algoTitle").textContent = data.title;
  document.getElementById("algoDesc").textContent = data.description;
  document.getElementById("timeBadge").textContent = `Время (Python): ${data.elapsed_us} мкс`;
  document.getElementById("countBadge").textContent = `Пикселей: ${state.pixels.length}`;

  renderTraceTable(data.trace_headers || [], data.trace_rows || []);
  drawScene();
}

function renderTraceTable(headers, rows) {
  const thead = document.querySelector("#traceTable thead");
  const tbody = document.querySelector("#traceTable tbody");
  thead.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  tbody.innerHTML = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
}

async function runBenchmark() {
  const payload = {
    x0: parseInt(document.getElementById("x0").value, 10) || 0,
    y0: parseInt(document.getElementById("y0").value, 10) || 0,
    x1: parseInt(document.getElementById("x1").value, 10) || 0,
    y1: parseInt(document.getElementById("y1").value, 10) || 0,
    xc: parseInt(document.getElementById("xc").value, 10) || 0,
    yc: parseInt(document.getElementById("yc").value, 10) || 0,
    r: parseInt(document.getElementById("radius").value, 10) || 0,
    iterations: 500,
  };

  const resp = await fetch("/api/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  const tbody = document.querySelector("#benchTable tbody");
  tbody.innerHTML = (data.results || [])
    .map(
      (row) => `<tr>
        <td>${row.name}</td>
        <td>${row.pixels_count}</td>
        <td><b>${row.avg_us}</b></td>
        <td>${row.total_ms}</td>
      </tr>`
    )
    .join("");
}

// События интерфейса
document.getElementById("algoSelect").addEventListener("change", requestRasterize);
document.getElementById("drawBtn").addEventListener("click", requestRasterize);
document.getElementById("benchBtn").addEventListener("click", runBenchmark);
document.getElementById("showIdeal").addEventListener("change", drawScene);

["x0", "y0", "x1", "y1", "xc", "yc", "radius"].forEach((id) => {
  document.getElementById(id).addEventListener("change", requestRasterize);
});

document.getElementById("zoomSlider").addEventListener("input", (e) => {
  state.cellSize = parseInt(e.target.value, 10);
  document.getElementById("zoomVal").textContent = state.cellSize;
  drawScene();
});

document.getElementById("resetViewBtn").addEventListener("click", () => {
  centerOrigin();
  drawScene();
});

// Масштабирование колесом мыши и перетаскивание
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 2 : -2;
  const next = Math.max(10, Math.min(64, state.cellSize + delta));
  state.cellSize = next;
  document.getElementById("zoomSlider").value = next;
  document.getElementById("zoomVal").textContent = next;
  drawScene();
});

canvas.addEventListener("mousedown", (e) => {
  state.dragging = true;
  state.dragMoved = false;
  state.lastMouseX = e.clientX;
  state.lastMouseY = e.clientY;
  canvas.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  if (e.target === canvas) {
    const { gx, gy } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    document.getElementById("cursorCoords").textContent = `Ячейка: (${gx}, ${gy})`;
  }
  if (!state.dragging) return;
  const dx = e.clientX - state.lastMouseX;
  const dy = e.clientY - state.lastMouseY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.dragMoved = true;
  state.offsetX += dx;
  state.offsetY += dy;
  state.lastMouseX = e.clientX;
  state.lastMouseY = e.clientY;
  drawScene();
});

window.addEventListener("mouseup", (e) => {
  if (!state.dragging) return;
  state.dragging = false;
  canvas.style.cursor = "grab";

  // Клик без перетаскивания задаёт координаты
  if (!state.dragMoved && e.target === canvas) {
    const rect = canvas.getBoundingClientRect();
    const { gx, gy } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    if (state.algorithm === "bresenham_circle") {
      document.getElementById("xc").value = gx;
      document.getElementById("yc").value = gy;
    } else {
      if (state.clickStage === 0) {
        document.getElementById("x0").value = gx;
        document.getElementById("y0").value = gy;
        state.clickStage = 1;
      } else {
        document.getElementById("x1").value = gx;
        document.getElementById("y1").value = gy;
        state.clickStage = 0;
      }
    }
    requestRasterize();
  }
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
requestRasterize();