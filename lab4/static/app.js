const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl", { antialias: true });

if (!gl) {
  document.getElementById("glStatus").textContent = "Ошибка: WebGL не поддерживается";
}

// =========================================================================
// 1. ШЕЙДЕРЫ (строго совместимы с WebGL 1.0 / GLSL ES 1.00)
// =========================================================================

const VS_MESH = `
  attribute vec3 aPos;
  attribute vec3 aNormal;
  attribute vec2 aUV;
  uniform mat4 uModel;
  uniform mat4 uViewProj;
  varying vec3 vNormal;
  varying vec2 vUV;
  void main() {
    vec4 worldPos = uModel * vec4(aPos, 1.0);
    vNormal = (uModel * vec4(aNormal, 0.0)).xyz;
    vUV = aUV;
    gl_Position = uViewProj * worldPos;
  }
`;

const FS_MESH = `
  precision mediump float;
  varying vec3 vNormal;
  varying vec2 vUV;
  uniform sampler2D uTex;
  uniform int uWireframe;
  void main() {
    if (uWireframe == 1) {
      gl_FragColor = vec4(0.22, 0.74, 0.97, 1.0);
      return;
    }
    vec3 n = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.55, 0.75, 0.85));
    float diff = max(dot(n, lightDir), 0.0);
    float backDiff = max(dot(n, vec3(-0.4, -0.3, -0.7)), 0.0) * 0.25;
    vec3 texColor = texture2D(uTex, vUV).rgb;
    vec3 lit = texColor * (0.35 + 0.65 * diff + backDiff);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const VS_LINE = `
  attribute vec3 aPos;
  attribute vec3 aColor;
  uniform mat4 uViewProj;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = uViewProj * vec4(aPos, 1.0);
  }
`;

const FS_LINE = `
  precision mediump float;
  varying vec3 vColor;
  void main() { gl_FragColor = vec4(vColor, 1.0); }
`;

function compileShader(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(sh);
    console.error("Ошибка шейдера:", err);
    document.getElementById("glStatus").textContent = "Ошибка шейдера";
  }
  return sh;
}

function createProgram(vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Ошибка линковки:", gl.getProgramInfoLog(prog));
  }
  return prog;
}

const meshProg = createProgram(VS_MESH, FS_MESH);
const lineProg = createProgram(VS_LINE, FS_LINE);

const meshBuffers = {
  pos: gl.createBuffer(),
  norm: gl.createBuffer(),
  uv: gl.createBuffer(),
  idx: gl.createBuffer(),
  wireIdx: gl.createBuffer(),
  indexCount: 0,
  wireCount: 0,
};

// Оси координат (X красн., Y зел., Z син.)
const axisBuffer = gl.createBuffer();
const axisColorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-5,0,0, 5,0,0, 0,-4,0, 0,4,0, 0,0,-5, 0,0,5]), gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, axisColorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  0.95,0.28,0.28, 0.95,0.28,0.28,
  0.20,0.83,0.45, 0.20,0.83,0.45,
  0.25,0.56,0.98, 0.25,0.56,0.98
]), gl.STATIC_DRAW);

// =========================================================================
// 2. МАТРИЦЫ КАМЕРЫ И ПРОЕКЦИИ (СТОРОНА НАБЛЮДАТЕЛЯ)
// =========================================================================

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function mat4Perspective(fovDeg, aspect, near, far) {
  const f = 1.0 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4LookAt(eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}

// =========================================================================
// 3. ТЕКСТУРЫ
// =========================================================================

const glTexture = gl.createTexture();

function applyTextureCanvas(srcCanvas) {
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  const prev = document.getElementById("texPreviewCanvas");
  prev.getContext("2d").drawImage(srcCanvas, 0, 0, prev.width, prev.height);
}

function generateProceduralTexture(kind) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");

  if (kind === "wood") {
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const v = Math.sin(x * 0.14 + Math.sin(y * 0.06) * 3.2) * 0.5 + 0.5;
        const grain = Math.sin(y * 0.5 + x * 0.1) * 10;
        const i = (y * 256 + x) * 4;
        img.data[i] = Math.min(255, 120 + v * 75 + grain);
        img.data[i + 1] = Math.min(255, 70 + v * 48 + grain * 0.6);
        img.data[i + 2] = Math.min(255, 32 + v * 25);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  } else if (kind === "marble") {
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = Math.sin((x + y) * 0.08 + Math.sin(x * 0.05) * 4.0) * 0.5 + 0.5;
        const base = 155 + n * 85;
        const i = (y * 256 + x) * 4;
        img.data[i] = base * 0.92;
        img.data[i + 1] = base * 0.96;
        img.data[i + 2] = base;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  } else if (kind === "brick") {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 0, 256, 256);
    const bh = 32, bw = 64;
    for (let r = 0; r < 8; r++) {
      const shift = (r % 2) * (bw / 2);
      for (let col = -1; col <= 4; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? "#b91c1c" : "#c2410c";
        ctx.fillRect(col * bw + shift + 3, r * bh + 3, bw - 6, bh - 6);
      }
    }
  } else {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#38bdf8" : "#1e293b";
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
    }
  }
  applyTextureCanvas(c);
}

// =========================================================================
// 4. ВЗАИМОДЕЙСТВИЕ С PYTHON API И ОТРИСОВКА СЦЕНЫ
// =========================================================================

let lastMeshData = null;
let modelMatrixColMajor = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const cam = { yaw: 0.45, pitch: 0.35, dist: 10.5 };

async function fetchMeshFromPython() {
  const surname = document.getElementById("surnameInput").value;
  const depth = parseFloat(document.getElementById("depthSlider").value);
  document.getElementById("depthVal").textContent = depth.toFixed(2);

  const resp = await fetch("/api/mesh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surname, depth }),
  });
  const mesh = await resp.json();
  lastMeshData = mesh;

  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.pos);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.norm);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.uv);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffers.idx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
  meshBuffers.indexCount = mesh.indices.length;

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffers.wireIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.wire_indices), gl.STATIC_DRAW);
  meshBuffers.wireCount = mesh.wire_indices.length;

  document.getElementById("statVerts").textContent = `Вершин: ${mesh.vertex_count}`;
  document.getElementById("statTris").textContent = `Треугольников: ${mesh.triangle_count}`;

  const tbody = document.getElementById("vertexTableBody");
  tbody.innerHTML = mesh.vertices_preview
    .map((v) => `<tr><td>${v.index}</td><td>${v.x}</td><td>${v.y}</td><td>${v.z}</td><td>${v.u}</td><td>${v.v}</td></tr>`)
    .join("");
}

let transformBusy = false;
async function fetchTransformFromPython() {
  if (transformBusy) return;
  transformBusy = true;
  try {
    const val = (id) => parseFloat(document.getElementById(id).value);
    const tx = val("tx"), ty = val("ty"), tz = val("tz");
    const rx = val("rx"), ry = val("ry"), rz = val("rz");
    const sx = val("sx"), sy = val("sy"), sz = val("sz");
    const order = document.getElementById("orderSelect").value;

    document.getElementById("txVal").textContent = tx.toFixed(2);
    document.getElementById("tyVal").textContent = ty.toFixed(2);
    document.getElementById("tzVal").textContent = tz.toFixed(2);
    document.getElementById("rxVal").textContent = `${Math.round(rx)}°`;
    document.getElementById("ryVal").textContent = `${Math.round(ry)}°`;
    document.getElementById("rzVal").textContent = `${Math.round(rz)}°`;
    document.getElementById("sxVal").textContent = sx.toFixed(2);
    document.getElementById("syVal").textContent = sy.toFixed(2);
    document.getElementById("szVal").textContent = sz.toFixed(2);

    const resp = await fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx, ty, tz, rx, ry, rz, sx, sy, sz, order }),
    });
    const data = await resp.json();
    modelMatrixColMajor = new Float32Array(data.matrix_col_major);

    const grid = document.getElementById("matrixGrid");
    let html = "";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = data.matrix_row_major[r][c];
        const cls = c === 3 && r < 3 ? "m-cell trans" : r === 3 ? "m-cell homog" : "m-cell";
        html += `<div class="${cls}">${(Math.abs(v) < 1e-4 ? 0 : v).toFixed(3)}</div>`;
      }
    }
    grid.innerHTML = html;
    document.getElementById("matrixFormula").textContent = data.formula;
  } finally {
    transformBusy = false;
  }
}

let spinFrame = 0;
function renderFrame() {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(200, Math.floor(canvas.clientWidth * dpr));
  const ch = Math.max(200, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  if (document.getElementById("autoSpinChk").checked) {
    spinFrame++;
    const ryEl = document.getElementById("ry");
    let next = parseFloat(ryEl.value) + 0.8;
    if (next > 180) next -= 360;
    ryEl.value = next;
    if (spinFrame % 3 === 0) fetchTransformFromPython();
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.015, 0.03, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const eye = [
    cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
    cam.dist * Math.sin(cam.pitch),
    cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw),
  ];
  const V = mat4LookAt(eye, [0, 0, 0], [0, 1, 0]);
  const P = mat4Perspective(45, canvas.width / canvas.height, 0.1, 100);
  const VP = mat4Multiply(P, V);

  // Оси X, Y, Z
  gl.useProgram(lineProg);
  gl.uniformMatrix4fv(gl.getUniformLocation(lineProg, "uViewProj"), false, VP);

  const aLinePos = gl.getAttribLocation(lineProg, "aPos");
  gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
  gl.enableVertexAttribArray(aLinePos);
  gl.vertexAttribPointer(aLinePos, 3, gl.FLOAT, false, 0, 0);

  const aLineCol = gl.getAttribLocation(lineProg, "aColor");
  gl.bindBuffer(gl.ARRAY_BUFFER, axisColorBuffer);
  gl.enableVertexAttribArray(aLineCol);
  gl.vertexAttribPointer(aLineCol, 3, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.LINES, 0, 6);

  // 3D-фамилия
  if (meshBuffers.indexCount > 0) {
    gl.useProgram(meshProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(meshProg, "uModel"), false, modelMatrixColMajor);
    gl.uniformMatrix4fv(gl.getUniformLocation(meshProg, "uViewProj"), false, VP);
    const isWire = document.getElementById("wireframeChk").checked;
    gl.uniform1i(gl.getUniformLocation(meshProg, "uWireframe"), isWire ? 1 : 0);

    const aPos = gl.getAttribLocation(meshProg, "aPos");
    if (aPos >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.pos);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    }

    const aNorm = gl.getAttribLocation(meshProg, "aNormal");
    if (aNorm >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.norm);
      gl.enableVertexAttribArray(aNorm);
      gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
    }

    const aUV = gl.getAttribLocation(meshProg, "aUV");
    if (aUV >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffers.uv);
      gl.enableVertexAttribArray(aUV);
      gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.uniform1i(gl.getUniformLocation(meshProg, "uTex"), 0);

    if (isWire) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffers.wireIdx);
      gl.drawElements(gl.LINES, meshBuffers.wireCount, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshBuffers.idx);
      gl.drawElements(gl.TRIANGLES, meshBuffers.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  requestAnimationFrame(renderFrame);
}

// =========================================================================
// 5. СОБЫТИЯ
// =========================================================================

document.getElementById("buildBtn").addEventListener("click", fetchMeshFromPython);
document.getElementById("surnameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchMeshFromPython();
});
document.getElementById("depthSlider").addEventListener("input", fetchMeshFromPython);

["tx","ty","tz","rx","ry","rz","sx","sy","sz","orderSelect"].forEach((id) => {
  document.getElementById(id).addEventListener("input", fetchTransformFromPython);
  document.getElementById(id).addEventListener("change", fetchTransformFromPython);
});

document.getElementById("textureSelect").addEventListener("change", (e) => {
  generateProceduralTexture(e.target.value);
});

document.getElementById("texUpload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    c.getContext("2d").drawImage(img, 0, 0, 256, 256);
    applyTextureCanvas(c);
  };
  img.src = URL.createObjectURL(file);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  ["tx","ty","tz","rx","ry","rz"].forEach((id) => document.getElementById(id).value = 0);
  ["sx","sy","sz"].forEach((id) => document.getElementById(id).value = 1);
  document.getElementById("autoSpinChk").checked = false;
  fetchTransformFromPython();
});

document.getElementById("downloadVertsBtn").addEventListener("click", () => {
  if (!lastMeshData) return;
  const verts = [];
  for (let i = 0; i < lastMeshData.vertex_count; i++) {
    verts.push({
      index: i,
      x: lastMeshData.positions[i * 3],
      y: lastMeshData.positions[i * 3 + 1],
      z: lastMeshData.positions[i * 3 + 2],
      u: lastMeshData.uvs[i * 2],
      v: lastMeshData.uvs[i * 2 + 1],
    });
  }
  const blob = new Blob([JSON.stringify(verts, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "surname_vertices.json";
  a.click();
});

let camDrag = false, lx = 0, ly = 0;
canvas.addEventListener("mousedown", (e) => { camDrag = true; lx = e.clientX; ly = e.clientY; });
window.addEventListener("mousemove", (e) => {
  if (!camDrag) return;
  cam.yaw -= (e.clientX - lx) * 0.008;
  cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + (e.clientY - ly) * 0.008));
  lx = e.clientX; ly = e.clientY;
});
window.addEventListener("mouseup", () => { camDrag = false; });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  cam.dist = Math.max(3.0, Math.min(25.0, cam.dist + e.deltaY * 0.01));
});

// Старт
generateProceduralTexture("wood");
fetchMeshFromPython();
fetchTransformFromPython();
requestAnimationFrame(renderFrame);