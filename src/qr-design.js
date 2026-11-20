import QRCode from 'qrcode';
import alignmentPattern from 'qrcode/lib/core/alignment-pattern.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULTS = {
  size: 43,
  margin: 24,
  dotSize: 100,
  roundness: 0,
  finderRoundness: 0,
  foreground: '#18181b',
  background: '#ffffff',
  gradient: false,
  gradientColor: '#2563eb',
  gradientAngle: 0,
  ecc: 'H',
  logo: null,
  logoSize: 60,
  logoRoundness: 20,
};

function percent(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
}

function coordinate(value) {
  return String(Number(value.toFixed(4)));
}

function color(value, fallback) {
  const result = String(value ?? fallback);
  if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(result)) {
    throw new Error('请输入有效的十六进制颜色，例如 #18181b 或 #18181b80。');
  }
  let hex = result.slice(1).toLowerCase();
  if (hex.length <= 4) hex = [...hex].map(character => character.repeat(2)).join('');
  return { rgb: `#${hex.slice(0, 6)}`, alpha: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1 };
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[character]));
}

/** A MIME label alone is insufficient: also verify the raster file signature. */
function rasterDataURL(value) {
  if (value == null || value === '') return null;
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(String(value));
  if (!match || match[2].length > 12_000_000 || match[2].length % 4 !== 0) {
    throw new Error('Logo 仅支持 PNG、JPEG 或 WebP 图片。');
  }
  let header;
  try { header = atob(match[2].slice(0, 64)); }
  catch { throw new Error('Logo 图片编码无效。'); }
  const mime = match[1].toLowerCase();
  const byte = index => header.charCodeAt(index);
  const png = header.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => byte(i) === value);
  const jpeg = header.length >= 3 && byte(0) === 255 && byte(1) === 216 && byte(2) === 255;
  const webp = header.length >= 12 && header.slice(0, 4) === 'RIFF' && header.slice(8, 12) === 'WEBP';
  if (!(mime === 'png' ? png : mime === 'webp' ? webp : jpeg)) {
    throw new Error('Logo 文件内容与图片格式不匹配。');
  }
  return String(value);
}

function squarePath(x, y, width = 1) {
  return `M${coordinate(x)} ${coordinate(y)}h${coordinate(width)}v${coordinate(width)}h-${coordinate(width)}z`;
}

function rect(x, y, width, radius = 0, fill = '') {
  return `<rect x="${coordinate(x)}" y="${coordinate(y)}" width="${coordinate(width)}" height="${coordinate(width)}" rx="${coordinate(radius)}"${fill ? ` fill="${fill}"` : ''}/>`;
}

function roundedSquarePath(x, y, width, radius = 0) {
  const r = Math.min(width / 2, Math.max(0, radius));
  if (!r) return squarePath(x, y, width);
  const n = coordinate;
  return `M${n(x + r)} ${n(y)}H${n(x + width - r)}Q${n(x + width)} ${n(y)} ${n(x + width)} ${n(y + r)}V${n(y + width - r)}Q${n(x + width)} ${n(y + width)} ${n(x + width - r)} ${n(y + width)}H${n(x + r)}Q${n(x)} ${n(y + width)} ${n(x)} ${n(y + width - r)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
}

function ring(x, y, width, outerRadius, innerRadius) {
  return `<path d="${roundedSquarePath(x, y, width, outerRadius)}${roundedSquarePath(x + 1, y + 1, width - 2, innerRadius)}" fill-rule="evenodd"/>`;
}

function shortHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

/**
 * Build a standalone, self-contained QR SVG. Continuous settings use 0–100;
 * margin is the actual number of export pixels, with no hidden minimum.
 * `modules` is the symbol's side length in modules, excluding its margin.
 * Timing, format and version modules follow the same dot styling as data.
 * Finder and alignment patterns retain their nested structure and share the
 * locator corner-radius control.
 */
export function buildQrSvg(payload, settings = {}) {
  const ecc = ['L', 'M', 'Q', 'H'].includes(settings.ecc) ? settings.ecc : DEFAULTS.ecc;
  const qr = QRCode.create(payload, { errorCorrectionLevel: ecc });
  const matrix = qr.modules;
  const modules = matrix.size;
  // Eight-pixel increments preserve useful export dimensions; 43 gives 1024px.
  const size = Math.round((256 + 1792 * percent(settings.size, DEFAULTS.size) / 100) / 8) * 8;
  const margin = percent(settings.margin, DEFAULTS.margin);
  const moduleSize = (size - margin * 2) / modules;
  const dotSize = 0.68 + 0.32 * percent(settings.dotSize, DEFAULTS.dotSize) / 100;
  const dotRadius = dotSize * 0.5 * percent(settings.roundness, DEFAULTS.roundness) / 100;
  const inset = (1 - dotSize) / 2;
  const finderRadius = percent(settings.finderRoundness, DEFAULTS.finderRoundness) / 100;
  const foreground = color(settings.foreground, DEFAULTS.foreground);
  const background = color(settings.background, DEFAULTS.background);
  const gradientColor = color(settings.gradientColor, DEFAULTS.gradientColor);
  const logo = rasterDataURL(settings.logo);
  const logoWidth = logo ? modules * 0.22 * percent(settings.logoSize, DEFAULTS.logoSize) / 100 : 0;
  const logoRadius = logoWidth * 0.5 * percent(settings.logoRoundness, DEFAULTS.logoRoundness) / 100;
  const logoX = (modules - logoWidth) / 2;
  const padding = logoWidth > 0 ? Math.min(0.45, logoWidth * 0.1) : 0;
  const plateStart = logoX - padding;
  const plateEnd = logoX + logoWidth + padding;
  const hash = shortHash(`${payload}|${foreground.rgb}|${foreground.alpha}|${background.rgb}|${background.alpha}|${gradientColor.rgb}|${gradientColor.alpha}|${settings.gradientAngle}|${modules}|${logoWidth}`);
  const gradientID = `qr-gradient-${hash}`;
  const clipID = `qr-logo-${hash}`;
  const maskID = `qr-logo-mask-${hash}`;
  const fill = settings.gradient ? `url(#${gradientID})` : foreground.rgb;
  const foregroundOpacity = settings.gradient ? '' : ` fill-opacity="${foreground.alpha}"`;
  const defs = [];
  if (settings.gradient) {
    const angle = percent(settings.gradientAngle, DEFAULTS.gradientAngle) / 100 * Math.PI * 2;
    const dx = Math.cos(angle) * 0.5;
    const dy = Math.sin(angle) * 0.5;
    defs.push(`<linearGradient id="${gradientID}" gradientUnits="userSpaceOnUse" x1="${coordinate(modules * (0.5 - dx))}" y1="${coordinate(modules * (0.5 - dy))}" x2="${coordinate(modules * (0.5 + dx))}" y2="${coordinate(modules * (0.5 + dy))}"><stop offset="0" stop-color="${foreground.rgb}" stop-opacity="${foreground.alpha}"/><stop offset="1" stop-color="${gradientColor.rgb}" stop-opacity="${gradientColor.alpha}"/></linearGradient>`);
  }
  if (logoWidth > 0) defs.push(`<clipPath id="${clipID}">${rect(logoX, logoX, logoWidth, logoRadius)}</clipPath>`);

  const finders = [[0, 0], [modules - 7, 0], [0, modules - 7]];
  const inFinder = (row, col) => finders.some(([x, y]) => col >= x && col < x + 7 && row >= y && row < y + 7);
  const alignments = alignmentPattern.getPositions(qr.version);
  const alignmentCells = new Uint8Array(modules * modules);
  for (const [row, col] of alignments) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) alignmentCells[(row + dy) * modules + col + dx] = 1;
    }
  }
  const styledDot = (x, y) => rect(x + inset, y + inset, dotSize, dotRadius);
  const alignmentShape = ([row, col]) => {
    const x = col - 2;
    const y = row - 2;
    return ring(x, y, 5, finderRadius, finderRadius * 0.6)
      + rect(x + 2, y + 2, 1, finderRadius * 0.5);
  };
  const data = [];
  let logoFunctionMask = '';
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      const x = col;
      const y = row;
      const dark = Boolean(matrix.get(row, col));
      const reserved = matrix.isReserved(row, col);
      const overlapsLogo = logoWidth > 0 && x < plateEnd && x + 1 > plateStart && y < plateEnd && y + 1 > plateStart;
      // Cut the logo out of both light and dark functional cells. This prevents
      // covering alignment/format content without redrawing semitransparent ink.
      if (reserved && overlapsLogo) {
        logoFunctionMask += squarePath(x, y);
      }
      if (inFinder(row, col) || alignmentCells[row * modules + col]) continue;
      if (dark && (reserved || !overlapsLogo)) data.push(styledDot(x, y));
    }
  }
  const finderShapes = finders.map(([col, row]) => {
    const x = col;
    const y = row;
    return ring(x, y, 7, finderRadius * 1.4, finderRadius * 0.9)
      + rect(x + 2, y + 2, 3, finderRadius * 0.7);
  }).join('');
  const alignmentShapes = alignments.map(position => alignmentShape(position)).join('');
  let logoShapes = '';
  if (logoWidth > 0) {
    if (logoFunctionMask) defs.push(`<mask id="${maskID}" maskUnits="userSpaceOnUse" mask-type="luminance" x="${coordinate(logoX)}" y="${coordinate(logoX)}" width="${coordinate(logoWidth)}" height="${coordinate(logoWidth)}">${rect(logoX, logoX, logoWidth, 0, '#ffffff')}<path d="${logoFunctionMask}" fill="#000000"/></mask>`);
    logoShapes = `<image x="${coordinate(logoX)}" y="${coordinate(logoX)}" width="${coordinate(logoWidth)}" height="${coordinate(logoWidth)}" href="${escapeAttribute(logo)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipID})"${logoFunctionMask ? ` mask="url(#${maskID})"` : ''}/>`;
  }
  const squareRendering = dotRadius === 0 && dotSize === 1 ? ' shape-rendering="crispEdges"' : '';
  // Background is painted once. Finder/alignment rings have real geometric
  // holes, so transparent light modules never reveal an underlying dark square.
  const svg = `<svg xmlns="${SVG_NS}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="二维码"><defs>${defs.join('')}</defs><rect width="${size}" height="${size}" fill="${background.rgb}" fill-opacity="${background.alpha}"/><g transform="translate(${coordinate(margin)} ${coordinate(margin)}) scale(${moduleSize})"><g fill="${fill}"${foregroundOpacity}><g${squareRendering}>${data.join('')}</g>${finderShapes}${alignmentShapes}</g>${logoShapes}</g></svg>`;
  return { svg, size, modules };
}

/** Reject external assets and active SVG content before loading into an image. */
function validateExportSVG(svg) {
  if (typeof svg !== 'string' || svg.length > 8_000_000 || /<\?|<!/.test(svg)) throw new Error('SVG 内容无效。');
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('SVG 内容无效。');
  const tags = new Set(['svg', 'defs', 'linearGradient', 'stop', 'g', 'rect', 'path', 'clipPath', 'mask', 'image']);
  const attributes = new Set(['xmlns', 'width', 'height', 'viewBox', 'role', 'aria-label', 'x', 'y', 'rx', 'ry', 'fill', 'fill-opacity', 'd', 'fill-rule', 'id', 'x1', 'y1', 'x2', 'y2', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'clip-path', 'mask', 'maskUnits', 'mask-type', 'transform', 'preserveAspectRatio', 'href', 'shape-rendering']);
  for (const element of parsed.querySelectorAll('*')) {
    if (element.namespaceURI !== SVG_NS || !tags.has(element.localName)) throw new Error('SVG 包含不支持的内容。');
    for (const attribute of element.attributes) {
      if (!attributes.has(attribute.name)) throw new Error('SVG 包含不支持的属性。');
      if (attribute.name === 'href') rasterDataURL(attribute.value);
      if (/url\s*\(/i.test(attribute.value) && !/^url\(#[a-z_][\w.-]*\)$/i.test(attribute.value)) throw new Error('SVG 不允许外部资源。');
    }
  }
}

/** Convert a buildQrSvg result to a PNG Blob without uploading or fetching assets. */
export async function svgToPngBlob(svg, size = 1024) {
  validateExportSVG(svg);
  const pixels = Math.round(Number(size));
  if (!Number.isFinite(pixels) || pixels < 1 || pixels > 4096) throw new Error('导出尺寸无效。');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('无法导出这张二维码。'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持图片导出。');
    context.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 导出失败。')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
