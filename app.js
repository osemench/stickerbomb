/* =============================================================
   Stickerbomb Editor — app.js
   ============================================================= */

'use strict';

// ── Constants ──────────────────────────────────────────────────
const MM_TO_PX = 3.7795275591; // 1 mm = this many screen px at 96 dpi
const HANDLE_TYPES = ['tl', 'tr', 'bl', 'br', 'rotate'];

// ── State ──────────────────────────────────────────────────────
const state = {
  // Canvas dimensions in mm
  canvasW: 340,
  canvasH: 230,
  // px size on screen (scaled by zoom)
  zoom: 1,
  bgColor: '#ffffff',
  showGrid: true,
  stickers: [],        // array of sticker data objects
  selectedId: null,
  nextId: 1,
};

// ── Built-in sticker library (emoji SVGs via CSS / data URIs) ──
// We'll generate some simple SVG sticker placeholders for demo
const BUILTIN_STICKERS = generateBuiltinStickers();

function generateBuiltinStickers() {
  // A set of fun SVG stickers represented as data URLs
  const items = [
    { label: '🌟', emoji: '⭐', bg: '#ffd700' },
    { label: '❤️', emoji: '❤️', bg: '#ff4757' },
    { label: '🔥', emoji: '🔥', bg: '#ff6348' },
    { label: '💀', emoji: '💀', bg: '#2f3542' },
    { label: '🌈', emoji: '🌈', bg: '#eccc68' },
    { label: '👾', emoji: '👾', bg: '#5352ed' },
    { label: '⚡', emoji: '⚡', bg: '#ffa502' },
    { label: '🎮', emoji: '🎮', bg: '#2ed573' },
    { label: '🍕', emoji: '🍕', bg: '#ff6b6b' },
    { label: '🚀', emoji: '🚀', bg: '#1e90ff' },
    { label: '💎', emoji: '💎', bg: '#48dbfb' },
    { label: '🎸', emoji: '🎸', bg: '#ff9f43' },
  ];

  return items.map((item, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="48" fill="${item.bg}" stroke="white" stroke-width="3"/>
      <text x="50" y="66" font-size="50" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${item.emoji}</text>
    </svg>`;
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { id: `builtin_${i}`, label: item.label, src: dataUrl };
  });
}

// ── DOM refs ───────────────────────────────────────────────────
const bgCanvas      = document.getElementById('bg-canvas');
const bgCtx         = bgCanvas.getContext('2d');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx    = overlayCanvas.getContext('2d');
const stickerLayer  = document.getElementById('sticker-layer');
const container     = document.getElementById('canvas-container');
const viewport      = document.getElementById('canvas-viewport');

const ctrlScale     = document.getElementById('ctrl-scale');
const ctrlScaleVal  = document.getElementById('ctrl-scale-val');
const ctrlRotate    = document.getElementById('ctrl-rotate');
const ctrlRotateVal = document.getElementById('ctrl-rotate-val');
const ctrlOpacity   = document.getElementById('ctrl-opacity');
const ctrlOpacityVal= document.getElementById('ctrl-opacity-val');
const ctrlFlipH     = document.getElementById('ctrl-flip-h');
const ctrlFlipV     = document.getElementById('ctrl-flip-v');
const ctrlDuplicate = document.getElementById('ctrl-duplicate');
const ctrlDelete    = document.getElementById('ctrl-delete');
const ctrlBringFront= document.getElementById('ctrl-bring-front');
const ctrlSendBack  = document.getElementById('ctrl-send-back');
const stickerControls = document.getElementById('sticker-controls');
const noSelHint     = document.getElementById('no-selection-hint');

const zoomLevelEl   = document.getElementById('zoom-level');
const bgColorInput  = document.getElementById('bg-color');
const showGridCheck = document.getElementById('show-grid');
const fileInput     = document.getElementById('file-input');
const uploadBtn     = document.getElementById('upload-btn');
const exportPngBtn  = document.getElementById('export-png');
const clearBtn      = document.getElementById('clear-canvas');
const exportDpiSel  = document.getElementById('export-dpi');
const canvasWInput  = document.getElementById('canvas-w');
const canvasHInput  = document.getElementById('canvas-h');
const applyCanvasBtn= document.getElementById('apply-canvas-size');
const zoomInBtn     = document.getElementById('zoom-in');
const zoomOutBtn    = document.getElementById('zoom-out');
const zoomFitBtn    = document.getElementById('zoom-fit');
const libContainer  = document.getElementById('sticker-library');

// ── Canvas sizing helpers ──────────────────────────────────────
function mmToPx(mm) { return Math.round(mm * MM_TO_PX * state.zoom); }
function canvasPxW() { return mmToPx(state.canvasW); }
function canvasPxH() { return mmToPx(state.canvasH); }

function resizeCanvases() {
  const w = canvasPxW();
  const h = canvasPxH();

  bgCanvas.width  = w;
  bgCanvas.height = h;
  bgCanvas.style.width  = w + 'px';
  bgCanvas.style.height = h + 'px';

  overlayCanvas.width  = w;
  overlayCanvas.height = h;
  overlayCanvas.style.width  = w + 'px';
  overlayCanvas.style.height = h + 'px';

  stickerLayer.style.width  = w + 'px';
  stickerLayer.style.height = h + 'px';

  container.style.width  = w + 'px';
  container.style.height = h + 'px';

  drawBackground();
  repositionAllStickers();
}

// ── Background / Grid rendering ────────────────────────────────
function drawBackground() {
  const w = bgCanvas.width;
  const h = bgCanvas.height;

  bgCtx.fillStyle = state.bgColor;
  bgCtx.fillRect(0, 0, w, h);

  if (state.showGrid) {
    const gridMm = 10;
    const step = mmToPx(gridMm) / state.zoom; // px per grid line on screen
    // Re-derive because mmToPx uses state.zoom
    const stepPx = Math.round(gridMm * MM_TO_PX * state.zoom);

    bgCtx.strokeStyle = 'rgba(0,0,0,0.07)';
    bgCtx.lineWidth = 1;
    bgCtx.beginPath();
    for (let x = 0; x <= w; x += stepPx) {
      bgCtx.moveTo(x + 0.5, 0);
      bgCtx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += stepPx) {
      bgCtx.moveTo(0, y + 0.5);
      bgCtx.lineTo(w, y + 0.5);
    }
    bgCtx.stroke();
  }
}

// ── Zoom ───────────────────────────────────────────────────────
function setZoom(z) {
  state.zoom = Math.max(0.2, Math.min(4, z));
  zoomLevelEl.textContent = Math.round(state.zoom * 100) + '%';
  resizeCanvases();
}

function zoomFit() {
  const vw = viewport.clientWidth  - 80;
  const vh = viewport.clientHeight - 80;
  const w  = state.canvasW * MM_TO_PX;
  const h  = state.canvasH * MM_TO_PX;
  const z  = Math.min(vw / w, vh / h);
  setZoom(z);
}

// ── Sticker data model ─────────────────────────────────────────
function createStickerData(src, naturalW, naturalH) {
  // Default sticker size: 60mm wide, preserving aspect ratio
  const defaultMm = 60;
  const aspect = naturalH / naturalW;
  const wMm = defaultMm;
  const hMm = defaultMm * aspect;

  return {
    id: state.nextId++,
    src,
    naturalW,
    naturalH,
    // position in mm from top-left of canvas
    xMm: (state.canvasW - wMm) / 2,
    yMm: (state.canvasH - hMm) / 2,
    wMm,
    hMm,
    scale: 1,   // multiplier on top of wMm/hMm
    rotate: 0,  // degrees
    opacity: 1,
    flipH: false,
    flipV: false,
    zIndex: state.stickers.length,
  };
}

// ── Sticker DOM element ────────────────────────────────────────
function createStickerEl(data) {
  const el = document.createElement('div');
  el.className = 'sticker-el';
  el.dataset.id = data.id;

  const img = document.createElement('img');
  img.src = data.src;
  img.draggable = false;
  el.appendChild(img);

  // Handles
  HANDLE_TYPES.forEach(type => {
    const h = document.createElement('div');
    h.className = `handle handle-${type}`;
    h.dataset.handle = type;
    el.appendChild(h);
  });

  stickerLayer.appendChild(el);
  applyStickerStyle(el, data);
  setupStickerEvents(el, data);
  return el;
}

function getStickerEl(id) {
  return stickerLayer.querySelector(`[data-id="${id}"]`);
}

function applyStickerStyle(el, data) {
  const pxW = mmToPx(data.wMm) * data.scale;
  const pxH = mmToPx(data.hMm) * data.scale;
  const pxX = mmToPx(data.xMm);
  const pxY = mmToPx(data.yMm);

  const scaleX = data.flipH ? -1 : 1;
  const scaleY = data.flipV ? -1 : 1;

  el.style.width   = pxW + 'px';
  el.style.height  = pxH + 'px';
  el.style.left    = pxX + 'px';
  el.style.top     = pxY + 'px';
  el.style.zIndex  = data.zIndex + 10;
  el.style.opacity = data.opacity;
  el.style.transform = `rotate(${data.rotate}deg) scale(${scaleX}, ${scaleY})`;

  const img = el.querySelector('img');
  img.style.width  = pxW + 'px';
  img.style.height = pxH + 'px';

  if (state.selectedId === data.id) {
    el.classList.add('selected');
  } else {
    el.classList.remove('selected');
  }
}

function repositionAllStickers() {
  state.stickers.forEach(data => {
    const el = getStickerEl(data.id);
    if (el) applyStickerStyle(el, data);
  });
}

// ── Drag / Resize / Rotate interaction ────────────────────────
let interaction = null; // { type, startX, startY, stickerData, ... }

function setupStickerEvents(el, data) {
  el.addEventListener('mousedown', (e) => {
    const handle = e.target.dataset.handle;
    if (!handle) {
      startDrag(e, data);
    } else if (handle === 'rotate') {
      startRotate(e, data);
    } else {
      startResize(e, data, handle);
    }
  });

  el.addEventListener('touchstart', (e) => {
    const handle = e.target.dataset.handle;
    const touch = e.touches[0];
    if (!handle) {
      startDrag(touch, data, true);
    } else if (handle === 'rotate') {
      startRotate(touch, data, true);
    } else {
      startResize(touch, data, handle, true);
    }
    e.preventDefault();
  }, { passive: false });
}

function containerRect() {
  return container.getBoundingClientRect();
}

function clientToCanvas(clientX, clientY) {
  const r = containerRect();
  return {
    x: (clientX - r.left) / state.zoom,
    y: (clientY - r.top)  / state.zoom,
  };
}

function startDrag(e, data) {
  selectSticker(data.id);
  const canvasPos = clientToCanvas(e.clientX, e.clientY);
  interaction = {
    type: 'drag',
    data,
    startCanvasX: canvasPos.x,
    startCanvasY: canvasPos.y,
    startXMm: data.xMm,
    startYMm: data.yMm,
  };
}

function startRotate(e, data) {
  selectSticker(data.id);
  const r = containerRect();
  const pxX = mmToPx(data.xMm) + mmToPx(data.wMm) * data.scale / 2;
  const pxY = mmToPx(data.yMm) + mmToPx(data.hMm) * data.scale / 2;
  const cx = r.left + pxX;
  const cy = r.top  + pxY;
  interaction = {
    type: 'rotate',
    data,
    cx,
    cy,
    startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
    startRotate: data.rotate,
  };
}

function startResize(e, data, handle) {
  selectSticker(data.id);
  interaction = {
    type: 'resize',
    data,
    handle,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startScale: data.scale,
    startWMm: data.wMm,
    startHMm: data.hMm,
  };
}

function onMouseMove(e) {
  if (!interaction) return;
  const { type, data } = interaction;

  if (type === 'drag') {
    const pos = clientToCanvas(e.clientX, e.clientY);
    const dxMm = (pos.x - interaction.startCanvasX) / MM_TO_PX;
    const dyMm = (pos.y - interaction.startCanvasY) / MM_TO_PX;
    data.xMm = interaction.startXMm + dxMm;
    data.yMm = interaction.startYMm + dyMm;
  } else if (type === 'rotate') {
    const angle = Math.atan2(e.clientY - interaction.cy, e.clientX - interaction.cx);
    const delta = (angle - interaction.startAngle) * (180 / Math.PI);
    data.rotate = Math.round(interaction.startRotate + delta);
    // Snap to 15° increments when Shift held
    if (e.shiftKey) {
      data.rotate = Math.round(data.rotate / 15) * 15;
    }
  } else if (type === 'resize') {
    const dx = e.clientX - interaction.startClientX;
    const dy = e.clientY - interaction.startClientY;
    const diagonal = Math.sqrt(dx * dx + dy * dy) * Math.sign(dx + dy);
    const scaleDelta = diagonal / 150;
    data.scale = Math.max(0.1, interaction.startScale + scaleDelta);
  }

  const el = getStickerEl(data.id);
  if (el) applyStickerStyle(el, data);
  updateControlPanel();
}

function onMouseUp() {
  interaction = null;
}

document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// Touch events
document.addEventListener('touchmove', (e) => {
  if (!interaction) return;
  onMouseMove(e.touches[0]);
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', () => { interaction = null; });

// ── Selection ──────────────────────────────────────────────────
function selectSticker(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  state.stickers.forEach(d => {
    const el = getStickerEl(d.id);
    if (el) {
      el.classList.toggle('selected', d.id === id);
    }
  });
  updateControlPanel();
  updateSidebarControls();
}

function deselectAll() {
  state.selectedId = null;
  state.stickers.forEach(d => {
    const el = getStickerEl(d.id);
    if (el) el.classList.remove('selected');
  });
  updateControlPanel();
  updateSidebarControls();
}

container.addEventListener('mousedown', (e) => {
  if (e.target === bgCanvas || e.target === container || e.target === stickerLayer || e.target === overlayCanvas) {
    deselectAll();
  }
});

// ── Control panel ──────────────────────────────────────────────
function updateControlPanel() {
  const data = getSelected();
  const hasSelection = !!data;
  stickerControls.classList.toggle('disabled', !hasSelection);
  noSelHint.style.display = hasSelection ? 'none' : '';

  if (!data) return;

  ctrlScale.value    = Math.round(data.scale * 100);
  ctrlScaleVal.textContent = Math.round(data.scale * 100) + '%';
  ctrlRotate.value   = data.rotate;
  ctrlRotateVal.textContent = data.rotate + '°';
  ctrlOpacity.value  = Math.round(data.opacity * 100);
  ctrlOpacityVal.textContent = Math.round(data.opacity * 100) + '%';
  ctrlFlipH.checked  = data.flipH;
  ctrlFlipV.checked  = data.flipV;
}

function updateSidebarControls() {
  updateControlPanel();
}

function getSelected() {
  return state.stickers.find(d => d.id === state.selectedId) || null;
}

// Sidebar control events
ctrlScale.addEventListener('input', () => {
  const data = getSelected(); if (!data) return;
  data.scale = ctrlScale.value / 100;
  ctrlScaleVal.textContent = ctrlScale.value + '%';
  applyStickerStyle(getStickerEl(data.id), data);
});

ctrlRotate.addEventListener('input', () => {
  const data = getSelected(); if (!data) return;
  data.rotate = parseInt(ctrlRotate.value);
  ctrlRotateVal.textContent = ctrlRotate.value + '°';
  applyStickerStyle(getStickerEl(data.id), data);
});

ctrlOpacity.addEventListener('input', () => {
  const data = getSelected(); if (!data) return;
  data.opacity = ctrlOpacity.value / 100;
  ctrlOpacityVal.textContent = ctrlOpacity.value + '%';
  applyStickerStyle(getStickerEl(data.id), data);
});

ctrlFlipH.addEventListener('change', () => {
  const data = getSelected(); if (!data) return;
  data.flipH = ctrlFlipH.checked;
  applyStickerStyle(getStickerEl(data.id), data);
});

ctrlFlipV.addEventListener('change', () => {
  const data = getSelected(); if (!data) return;
  data.flipV = ctrlFlipV.checked;
  applyStickerStyle(getStickerEl(data.id), data);
});

ctrlDuplicate.addEventListener('click', () => {
  const data = getSelected(); if (!data) return;
  addStickerFromData({ ...data, id: state.nextId++, xMm: data.xMm + 8, yMm: data.yMm + 8, zIndex: state.stickers.length });
});

ctrlDelete.addEventListener('click', deleteSelected);

ctrlBringFront.addEventListener('click', () => {
  const data = getSelected(); if (!data) return;
  const max = Math.max(...state.stickers.map(d => d.zIndex));
  data.zIndex = max + 1;
  applyStickerStyle(getStickerEl(data.id), data);
});

ctrlSendBack.addEventListener('click', () => {
  const data = getSelected(); if (!data) return;
  const min = Math.min(...state.stickers.map(d => d.zIndex));
  data.zIndex = min - 1;
  applyStickerStyle(getStickerEl(data.id), data);
});

function deleteSelected() {
  const data = getSelected(); if (!data) return;
  const el = getStickerEl(data.id);
  if (el) el.remove();
  state.stickers = state.stickers.filter(d => d.id !== data.id);
  deselectAll();
}

// ── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
  }
  if (e.key === 'Escape') {
    deselectAll();
  }
  // Nudge with arrow keys
  const data = getSelected();
  if (data && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    const step = e.shiftKey ? 10 : 1; // mm
    if (e.key === 'ArrowUp')    data.yMm -= step;
    if (e.key === 'ArrowDown')  data.yMm += step;
    if (e.key === 'ArrowLeft')  data.xMm -= step;
    if (e.key === 'ArrowRight') data.xMm += step;
    applyStickerStyle(getStickerEl(data.id), data);
    e.preventDefault();
  }
  // Ctrl+D duplicate
  if (e.ctrlKey && e.key === 'd') {
    ctrlDuplicate.click();
    e.preventDefault();
  }
  // Ctrl+Z placeholder
});

// ── Add sticker ────────────────────────────────────────────────
function addStickerFromSrc(src) {
  const img = new Image();
  img.onload = () => {
    const data = createStickerData(src, img.naturalWidth, img.naturalHeight);
    addStickerFromData(data);
  };
  img.onerror = () => console.warn('Could not load sticker:', src);
  img.src = src;
}

function addStickerFromData(data) {
  state.stickers.push(data);
  createStickerEl(data);
  selectSticker(data.id);
}

// ── Upload ─────────────────────────────────────────────────────
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  [...fileInput.files].forEach(readFileAsSticker);
  fileInput.value = '';
});

function readFileAsSticker(file) {
  const reader = new FileReader();
  reader.onload = (e) => addStickerFromSrc(e.target.result);
  reader.readAsDataURL(file);
}

// ── Drag & drop onto page ──────────────────────────────────────
const dropOverlay = document.createElement('div');
dropOverlay.id = 'drop-overlay';
dropOverlay.textContent = 'Drop images here';
document.body.appendChild(dropOverlay);

let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    dragCounter++;
    dropOverlay.classList.add('visible');
  }
});

document.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.remove('visible');
  }
});

document.addEventListener('dragover', (e) => { e.preventDefault(); });

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('visible');
  [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')).forEach(readFileAsSticker);
});

// ── Built-in sticker library ───────────────────────────────────
function buildLibraryUI() {
  libContainer.innerHTML = '';
  BUILTIN_STICKERS.forEach(s => {
    const thumb = document.createElement('div');
    thumb.className = 'lib-thumb';
    thumb.title = s.label;
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = s.label;
    thumb.appendChild(img);
    thumb.addEventListener('click', () => addStickerFromSrc(s.src));
    libContainer.appendChild(thumb);
  });
}

// ── Canvas size controls ───────────────────────────────────────
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.canvasW = parseInt(btn.dataset.w);
    state.canvasH = parseInt(btn.dataset.h);
    canvasWInput.value = state.canvasW;
    canvasHInput.value = state.canvasH;
    resizeCanvases();
  });
});

applyCanvasBtn.addEventListener('click', () => {
  state.canvasW = Math.max(100, parseInt(canvasWInput.value) || 340);
  state.canvasH = Math.max(100, parseInt(canvasHInput.value) || 230);
  resizeCanvases();
});

bgColorInput.addEventListener('input', () => {
  state.bgColor = bgColorInput.value;
  drawBackground();
});

showGridCheck.addEventListener('change', () => {
  state.showGrid = showGridCheck.checked;
  drawBackground();
});

// ── Zoom controls ──────────────────────────────────────────────
zoomInBtn.addEventListener('click',  () => setZoom(state.zoom * 1.25));
zoomOutBtn.addEventListener('click', () => setZoom(state.zoom / 1.25));
zoomFitBtn.addEventListener('click', zoomFit);

// Ctrl+Scroll to zoom
viewport.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.1 : 0.9;
  setZoom(state.zoom * delta);
}, { passive: false });

// ── Export ─────────────────────────────────────────────────────
exportPngBtn.addEventListener('click', exportPNG);

async function exportPNG() {
  const dpi = parseInt(exportDpiSel.value);
  const mmToExportPx = dpi / 25.4; // pixels per mm at chosen DPI
  const exportW = Math.round(state.canvasW * mmToExportPx);
  const exportH = Math.round(state.canvasH * mmToExportPx);

  const offscreen = document.createElement('canvas');
  offscreen.width  = exportW;
  offscreen.height = exportH;
  const ctx = offscreen.getContext('2d');

  // Background
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, exportW, exportH);

  // Grid (optional, skip for print)
  // Sort stickers by zIndex
  const sorted = [...state.stickers].sort((a, b) => a.zIndex - b.zIndex);

  for (const data of sorted) {
    await drawStickerToCtx(ctx, data, mmToExportPx);
  }

  const link = document.createElement('a');
  link.download = `stickerbomb_${state.canvasW}x${state.canvasH}mm_${dpi}dpi.png`;
  link.href = offscreen.toDataURL('image/png');
  link.click();
}

function drawStickerToCtx(ctx, data, mmToExportPx) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const pxW = data.wMm * data.scale * mmToExportPx;
      const pxH = data.hMm * data.scale * mmToExportPx;
      const cx  = (data.xMm + (data.wMm * data.scale) / 2) * mmToExportPx;
      const cy  = (data.yMm + (data.hMm * data.scale) / 2) * mmToExportPx;

      ctx.save();
      ctx.globalAlpha = data.opacity;
      ctx.translate(cx, cy);
      ctx.rotate(data.rotate * Math.PI / 180);
      ctx.scale(data.flipH ? -1 : 1, data.flipV ? -1 : 1);
      ctx.drawImage(img, -pxW / 2, -pxH / 2, pxW, pxH);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = data.src;
  });
}

// ── Clear canvas ───────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  if (!confirm('Clear all stickers?')) return;
  state.stickers.forEach(data => {
    const el = getStickerEl(data.id);
    if (el) el.remove();
  });
  state.stickers = [];
  deselectAll();
});

// ── Scroll canvas drop-target ──────────────────────────────────
// Allow dropping stickers directly onto the canvas
container.addEventListener('dragover', e => e.preventDefault());
container.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  dropOverlay.classList.remove('visible');
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  files.forEach(readFileAsSticker);
});

// ── Init ───────────────────────────────────────────────────────
function init() {
  buildLibraryUI();
  resizeCanvases();

  // Use requestAnimationFrame to ensure layout is settled before fitting
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      zoomFit();
    });
  });

  updateControlPanel();
}

init();
