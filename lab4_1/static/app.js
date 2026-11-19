const canvas = document.getElementById("sceneCanvas");
const ctx = canvas.getContext("2d");

const SAMPLES = {
  segments: `6 *число отрезков*
-4 2 14 8
2 -3 8 13
-5 8 15 14
1 2 9 8
-3 -2 4 12
11 -2 16 11
0 0 10 10 *Xmin Ymin Xmax Ymax*`,

  polygon: `6 *число вершин выпуклого многоугольника*
-3 4
1 -3
11 -2
14 5
8 13
-1 11
0 0 10 10 *Xmin Ymin Xmax Ymax*`
};

const state = {
  mode: "segments", // "segments" | "polygon"
  scale: 28,
  offsetX: 0,
  offsetY: 0,
  result: null,
  dragging: false,
  lx: 0,
  ly: 0,
};

function worldToScreen(wx, wy) {
  return {
    sx: state.offsetX + wx * state.scale,
    sy: state.offsetY - wy * state.scale,
  };
}

function screenToWorld(sx, sy) {
  return {
    wx: (sx - state.offsetX) / state.scale,
    wy: (state.offsetY - sy) / state.scale,
  };
}

function niceStep(pixelsPerUnit) {
  const targetPx = 55;
  const raw = targetPx / pixelsPerUnit;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  if (norm < 1.5) return 1 * pow;
  if (norm < 3.5) return 2 * pow;
  if (norm < 7.5) return 5 * pow;
  return 10 * pow;
}

function fitToView() {
  if (!state.result) return;
  const w = state.result.window;
  let minX = w.xmin, maxX = w.xmax, minY = w.ymin, maxY = w.ymax;

  if (state.mode === "segments") {
    for (const item of state.result.items) {
      const [x1, y1, x2, y2] = item.orig;
      minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
      minY = Math.min(minY, y1, y2); maxY = Math.max(maxY, y1, y2);
    }
  } else {
    for (const [x, y] of state.result.orig_polygon) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 0.78;
  state.scale = Math.max(4, Math.min(120, Math.min((canvas.width * pad) / spanX, (canvas.height * pad) / spanY)));
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  state.offsetX = canvas.width * 0.5 - cx * state.scale;
  state.offsetY = canvas.height * 0.5 + cy * state.scale;
  drawScene();
}

function drawScene() {
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
    canvas.width = Math.max(250, Math.floor(rect.width));
    canvas.height = Math.max(200, Math.floor(rect.height));
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  document.getElementById("scaleBadge").textContent = `Масштаб: ${state.scale.toFixed(1)} px/ед.`;

  // 1. Сетка и оси координат
  const step = niceStep(state.scale);
  const minWx = -state.offsetX / state.scale;
  const maxWx = (w - state.offsetX) / state.scale;
  const minWy = (state.offsetY - h) / state.scale;
  const maxWy = state.offsetY / state.scale;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = Math.floor(minWx / step) * step; gx <= maxWx; gx += step) {
    const sx = state.offsetX + gx * state.scale;
    ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
  }
  for (let gy = Math.floor(minWy / step) * step; gy <= maxWy; gy += step) {
    const sy = state.offsetY - gy * state.scale;
    ctx.moveTo(0, sy); ctx.lineTo(w, sy);
  }
  ctx.stroke();

  // Оси X и Y
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, state.offsetY); ctx.lineTo(w, state.offsetY);
  ctx.moveTo(state.offsetX, 0); ctx.lineTo(state.offsetX, h);
  ctx.stroke();

  // Подписи делений
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px ui-monospace, monospace";
  for (let gx = Math.floor(minWx / step) * step; gx <= maxWx; gx += step) {
    const sx = state.offsetX + gx * state.scale;
    const lbl = Number(gx.toFixed(2));
    ctx.fillText(String(lbl), sx + 3, Math.min(h - 6, Math.max(14, state.offsetY + 13)));
  }
  for (let gy = Math.floor(minWy / step) * step; gy <= maxWy; gy += step) {
    if (Math.abs(gy) < 1e-9) continue;
    const sy = state.offsetY - gy * state.scale;
    const lbl = Number(gy.toFixed(2));
    ctx.fillText(String(lbl), Math.min(w - 30, Math.max(4, state.offsetX + 5)), sy - 3);
  }

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("X", w - 18, Math.min(h - 10, Math.max(16, state.offsetY - 8)));
  ctx.fillText("Y", Math.min(w - 20, Math.max(8, state.offsetX + 10)), 16);

  if (!state.result) return;

  // 2. Отсекающее окно (синий/голубой)
  const win = state.result.window;
  const pBL = worldToScreen(win.xmin, win.ymin);
  const pTR = worldToScreen(win.xmax, win.ymax);
  ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
  ctx.fillRect(pBL.sx, pTR.sy, pTR.sx - pBL.sx, pBL.sy - pTR.sy);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.strokeRect(pBL.sx, pTR.sy, pTR.sx - pBL.sx, pBL.sy - pTR.sy);

  // 3. Отрисовка по режиму
  if (state.mode === "segments") {
    const showMid = document.getElementById("showMidpoints").checked;

    for (const item of state.result.items) {
      const [x1, y1, x2, y2] = item.orig;
      const a = worldToScreen(x1, y1);
      const b = worldToScreen(x2, y2);

      // Исходный отрезок (красный пунктир)
      ctx.save();
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      ctx.restore();

      // Средние точки деления
      if (showMid && item.midpoints) {
        ctx.fillStyle = "#fbbf24";
        for (const [mx, my] of item.midpoints) {
          const mp = worldToScreen(mx, my);
          ctx.beginPath();
          ctx.arc(mp.sx, mp.sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Видимая часть (ярко-зелёная сплошная)
      if (item.clipped) {
        const [cx1, cy1, cx2, cy2] = item.clipped;
        const ca = worldToScreen(cx1, cy1);
        const cb = worldToScreen(cx2, cy2);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(ca.sx, ca.sy);
        ctx.lineTo(cb.sx, cb.sy);
        ctx.stroke();

        [ca, cb].forEach((pt) => {
          ctx.fillStyle = "#4ade80";
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  } else {
    // Многоугольник: исходный (красный контур)
    const orig = state.result.orig_polygon;
    if (orig.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#f87171";
      ctx.fillStyle = "rgba(248, 113, 113, 0.10)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      orig.forEach(([x, y], i) => {
        const pt = worldToScreen(x, y);
        if (i === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Отсечённый многоугольник (зелёная заливка и контур)
    const clipped = state.result.clipped_polygon;
    if (clipped.length > 0) {
      ctx.strokeStyle = "#22c55e";
      ctx.fillStyle = "rgba(34, 197, 94, 0.28)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      clipped.forEach(([x, y], i) => {
        const pt = worldToScreen(x, y);
        if (i === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#4ade80";
      for (const [x, y] of clipped) {
        const pt = worldToScreen(x, y);
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

async function runClipping(shouldFit = false) {
  const errBox = document.getElementById("errorBox");
  errBox.style.display = "none";

  const endpoint = state.mode === "segments" ? "/api/clip-segments" : "/api/clip-polygon";
  const payload = {
    text: document.getElementById("dataTextarea").value,
    eps: parseFloat(document.getElementById("epsSlider").value),
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();

  if (!resp.ok) {
    errBox.textContent = data.error || "Ошибка разбора данных";
    errBox.style.display = "block";
    return;
  }

  state.result = data;
  document.getElementById("timeBadge").textContent = `Время (Python): ${data.elapsed_us} мкс`;
  renderTable(data);

  if (shouldFit) fitToView();
  else drawScene();
}

function renderTable(data) {
  const thead = document.querySelector("#resultTable thead");
  const tbody = document.querySelector("#resultTable tbody");

  if (state.mode === "segments") {
    document.getElementById("tableTitle").textContent = "Результаты отсечения отрезков (алгоритм средней точки)";
    document.getElementById("extraBadge").textContent = `Отрезков: ${data.items.length}`;
    thead.innerHTML = `<tr>
      <th>#</th><th>Исходный</th><th>Коды (P1 / P2)</th><th>Статус</th><th>Делений</th><th>Видимая часть</th>
    </tr>`;
    tbody.innerHTML = data.items
      .map((it, i) => `<tr>
        <td>${i + 1}</td>
        <td>(${it.orig[0]}, ${it.orig[1]}) → (${it.orig[2]}, ${it.orig[3]})</td>
        <td>${it.code1} / ${it.code2}</td>
        <td>${it.status}</td>
        <td>${it.subdivisions}</td>
        <td>${it.clipped ? `(${it.clipped[0]}, ${it.clipped[1]}) → (${it.clipped[2]}, ${it.clipped[3]})` : "—"}</td>
      </tr>`)
      .join("");
  } else {
    document.getElementById("tableTitle").textContent = "Этапы отсечения выпуклого многоугольника (Сазерленд–Ходжмен)";
    document.getElementById("extraBadge").textContent = data.is_convex ? "Выпуклый: Да" : "Внимание: невыпуклый";
    thead.innerHTML = `<tr>
      <th>Граница отсечения</th><th>Вершин после шага</th><th>Координаты вершин</th>
    </tr>`;
    tbody.innerHTML = data.stages
      .map((st) => `<tr>
        <td>${st.edge}</td>
        <td>${st.vertex_count}</td>
        <td>${st.vertices.map(([x, y]) => `(${x}, ${y})`).join(" → ") || "Пусто"}</td>
      </tr>`)
      .join("");
  }
}

function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  const isSeg = mode === "segments";
  document.getElementById("modeTitle").textContent = isSeg
    ? "Часть 1: Алгоритм средней точки"
    : "Часть 2: Алгоритм отсечения выпуклого многоугольника (Сазерленда–Ходжмена)";
  document.getElementById("formatLabel").textContent = isSeg
    ? "Данные (n, отрезки X1 Y1 X2 Y2, окно):"
    : "Данные (m, вершины X Y, окно):";
  document.getElementById("epsGroup").style.display = isSeg ? "flex" : "none";
  document.getElementById("midChkRow").style.display = isSeg ? "flex" : "none";
  document.getElementById("dataTextarea").value = SAMPLES[mode];
  runClipping(true);
}

// События
document.querySelectorAll(".tab-btn").forEach((b) => {
  b.addEventListener("click", () => switchMode(b.dataset.mode));
});

document.getElementById("runBtn").addEventListener("click", () => runClipping(false));
document.getElementById("sampleBtn").addEventListener("click", () => {
  document.getElementById("dataTextarea").value = SAMPLES[state.mode];
  runClipping(true);
});

document.getElementById("epsSlider").addEventListener("input", (e) => {
  document.getElementById("epsVal").textContent = e.target.value;
  runClipping(false);
});
document.getElementById("showMidpoints").addEventListener("change", drawScene);
document.getElementById("fitBtn").addEventListener("click", fitToView);
document.getElementById("resetCamBtn").addEventListener("click", () => {
  state.offsetX = canvas.width * 0.5;
  state.offsetY = canvas.height * 0.5;
  drawScene();
});

document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById("dataTextarea").value = reader.result;
    runClipping(true);
  };
  reader.readAsText(file, "utf-8");
});

// Масштаб и сдвиг мышью
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const before = screenToWorld(mx, my);
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  state.scale = Math.max(3, Math.min(200, state.scale * factor));
  state.offsetX = mx - before.wx * state.scale;
  state.offsetY = my + before.wy * state.scale;
  drawScene();
});

canvas.addEventListener("mousedown", (e) => {
  state.dragging = true;
  state.lx = e.clientX;
  state.ly = e.clientY;
  canvas.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  if (e.target === canvas) {
    const { wx, wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    document.getElementById("cursorBadge").textContent = `(x, y): (${wx.toFixed(1)}, ${wy.toFixed(1)})`;
  }
  if (!state.dragging) return;
  state.offsetX += e.clientX - state.lx;
  state.offsetY += e.clientY - state.ly;
  state.lx = e.clientX;
  state.ly = e.clientY;
  drawScene();
});

window.addEventListener("mouseup", () => {
  state.dragging = false;
  canvas.style.cursor = "grab";
});

window.addEventListener("resize", drawScene);

// Старт
switchMode("segments");