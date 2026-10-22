// utils/map-core.js —— 中国地图渲染与命中测试（纯逻辑，不依赖 wx API，可在 Node 中直接跑）
// 路径数据来自 china-map.js（DataV.GeoAtlas 100000_full，含台湾/港澳/南海诸岛）
const MAP = require('./china-map.js');

const JD_ADCODE = '100000_JD';
// 这 5 个区域被邻省外环包住（数据只保留外环、不含洞），必须最后绘制才不会被盖住
const TINY_LAST = [110000, 120000, 310000, 810000, 820000];
// 直辖市/特区标签偏移（地图单位），避开京津、港澳拥挤区
const TINY_OFFSET = {
  110000: { dx: -11, dy: 0, anchor: 'end' },
  120000: { dx: 12, dy: 2, anchor: 'start' },
  310000: { dx: 12, dy: 0, anchor: 'start' },
  810000: { dx: 12, dy: 0, anchor: 'start' },
  820000: { dx: -12, dy: 0, anchor: 'end' },
};

const COLOR = {
  unlit: '#EEE8DC',
  unlitStroke: '#DED5C5',
  lit: '#D79E58',
  litStroke: '#BE8443',
  selected: '#AE6231',
  selectedStroke: '#8C4C22',
  label: '#9A8F80',
  labelLit: '#553718',
  labelJd: '#A79C8D',
};

// "M1,2L3,4L5,6Z..." → { rings: [[x,y,x,y...]], bbox: [x0,y0,x1,y1] }
function parsePath(d) {
  const rings = [];
  let ring = null;
  const re = /([MLZ])([-\d.,]*)/g;
  let m;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    if (cmd === 'Z') {
      if (ring && ring.length >= 6) rings.push(ring);
      ring = null;
      continue;
    }
    const parts = m[2].split(',');
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!isFinite(x) || !isFinite(y)) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (cmd === 'M') {
      if (ring && ring.length >= 6) rings.push(ring);
      ring = [x, y];
    } else if (cmd === 'L' && ring) {
      ring.push(x, y);
    }
  }
  if (ring && ring.length >= 6) rings.push(ring);
  return { rings, bbox: [x0, y0, x1, y1] };
}

const PROVINCES = MAP.provinces.map(function (p) {
  const parsed = parsePath(p.d);
  return Object.assign({}, p, { rings: parsed.rings, bbox: parsed.bbox });
});

const WIDTH = MAP.width;
const HEIGHT = MAP.height;

// 射线法：点是否在环内
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1];
    const xj = ring[j], yj = ring[j + 1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function contains(p, x, y) {
  const b = p.bbox;
  if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
  for (let i = 0; i < p.rings.length; i++) {
    if (inRing(p.rings[i], x, y)) return true;
  }
  return false;
}

// 命中测试：传入地图坐标系（0..WIDTH / 0..HEIGHT）
function hitTest(x, y) {
  // 1) 直辖市 / 特区优先（它们被邻省外环包住）
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i];
    if (p.tiny && contains(p, x, y)) return p;
  }
  // 2) 标签就近（港澳的标签在海上，方便点中）
  let best = null;
  let bestD = 30;
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i];
    if (!p.tiny) continue;
    const d = Math.hypot(p.label[0] - x, p.label[1] - y);
    if (d < bestD) { best = p; bestD = d; }
  }
  if (best) return best;
  // 3) 常规省份
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i];
    if (p.adcode === JD_ADCODE || p.tiny) continue;
    if (contains(p, x, y)) return p;
  }
  return null;
}

function strokeProvince(ctx, p, k) {
  ctx.beginPath();
  for (let r = 0; r < p.rings.length; r++) {
    const ring = p.rings[r];
    ctx.moveTo(ring[0] * k, ring[1] * k);
    for (let i = 2; i < ring.length; i += 2) {
      ctx.lineTo(ring[i] * k, ring[i + 1] * k);
    }
    ctx.closePath();
  }
}

// 绘制整张地图
// opt: { width, height, lit: {adcode: count}, selected: adcode, showLabels: bool }
function draw(ctx, opt) {
  const W = opt.width;
  const H = opt.height;
  const k = Math.min(W / WIDTH, H / HEIGHT);
  const lit = opt.lit || {};
  const selected = opt.selected;
  const showLabels = opt.showLabels !== false;
  const fs = Math.max(8, Math.round(W * 0.026));
  const fsTiny = Math.max(7, Math.round(W * 0.021));

  ctx.clearRect(0, 0, W, H);

  const drawOne = function (p, isJd) {
    const isLit = !!lit[p.adcode];
    strokeProvince(ctx, p, k);
    if (isJd) {
      ctx.fillStyle = '#E4DCCB';
      ctx.strokeStyle = '#C9BCA4';
      ctx.lineWidth = 0.5;
    } else if (p.adcode === selected) {
      ctx.fillStyle = COLOR.selected;
      ctx.strokeStyle = COLOR.selectedStroke;
      ctx.lineWidth = 1;
    } else if (isLit) {
      ctx.fillStyle = COLOR.lit;
      ctx.strokeStyle = COLOR.litStroke;
      ctx.lineWidth = 0.7;
    } else {
      ctx.fillStyle = COLOR.unlit;
      ctx.strokeStyle = COLOR.unlitStroke;
      ctx.lineWidth = 0.6;
    }
    ctx.fill();
    ctx.stroke();
  };

  // 先画常规省份，再画被包裹的直辖市/特区，最后画南海诸岛
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i];
    if (p.adcode === JD_ADCODE || TINY_LAST.indexOf(p.adcode) >= 0) continue;
    drawOne(p, false);
  }
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i];
    if (TINY_LAST.indexOf(p.adcode) < 0) continue;
    drawOne(p, false);
  }
  for (let i = 0; i < PROVINCES.length; i++) {
    if (PROVINCES[i].adcode === JD_ADCODE) drawOne(PROVINCES[i], true);
  }

  if (!showLabels) return;

  // 标签
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i];
    const x = p.label[0] * k;
    const y = p.label[1] * k;
    if (p.adcode === JD_ADCODE) {
      ctx.font = Math.max(7, Math.round(fs * 0.85)) + 'px sans-serif';
      ctx.fillStyle = COLOR.labelJd;
      ctx.fillText('南海诸岛', x, y);
      continue;
    }
    if (p.tiny) {
      // 小区域画点 + 偏移标签，名称同时显示在弹层标题里
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.4, k * 4), 0, Math.PI * 2);
      ctx.fillStyle = lit[p.adcode] ? COLOR.selectedStroke : '#B9AE9C';
      ctx.fill();

      const off = TINY_OFFSET[p.adcode] || { dx: 12, dy: 0, anchor: 'start' };
      ctx.font = fsTiny + 'px sans-serif';
      ctx.textAlign = off.anchor === 'end' ? 'right' : 'left';
      ctx.fillStyle = lit[p.adcode] ? COLOR.labelLit : COLOR.label;
      ctx.fillText(p.short, x + off.dx * k, y + off.dy * k);
      ctx.textAlign = 'center';
      continue;
    }
    const isLit = !!lit[p.adcode];
    ctx.font = (isLit ? '600 ' : '') + fs + 'px sans-serif';
    ctx.fillStyle = p.adcode === selected ? '#3A2312' : (isLit ? COLOR.labelLit : COLOR.label);
    ctx.fillText(p.short, x, y);
  }
}

// 省级名归一化：内蒙古自治区/广西壮族自治区/香港特别行政区… → 内蒙古/广西/香港
function normProv(name) {
  if (!name) return '';
  let s = String(name).trim();
  s = s.replace(/(特别行政区|自治区|省|市)$/, '');
  s = s.replace(/(壮族|回族|维吾尔)$/, '');
  return s;
}

// 由简称找省级记录（「广东」→ 「广东省」）
function provinceByShort(short) {
  for (let i = 0; i < PROVINCES.length; i++) {
    if (PROVINCES[i].short === short) return PROVINCES[i];
  }
  return null;
}

module.exports = {
  WIDTH, HEIGHT, PROVINCES, COLOR,
  parsePath, hitTest, draw, normProv, provinceByShort,
};
