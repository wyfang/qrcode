export const STYLE_STORAGE_KEY = 'qrcode-demo-style';
const VERSION = 1;
const MAX_LOGO_LENGTH = 2 * 1024 * 1024;
const MAX_RECORD_LENGTH = MAX_LOGO_LENGTH + 8192;
const NUMBER_KEYS = ['size', 'margin', 'dotSize', 'roundness', 'finderRoundness', 'gradientAngle', 'logoSize', 'logoRoundness'];
const COLOR_KEYS = ['foreground', 'background', 'gradientColor'];
export const STORAGE_ERROR = '浏览器未能保存样式，请检查本地存储权限或剩余空间。';

const browserStorage = () => window.localStorage;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeColor(value) {
  if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return null;
  let hex = value.slice(1).toUpperCase();
  if (hex.length < 5) hex = [...hex].map(digit => digit + digit).join('');
  if (hex.length === 8 && hex.endsWith('FF')) hex = hex.slice(0, 6);
  return `#${hex}`;
}

function isLogo(value) {
  if (typeof value !== 'string' || value.length > MAX_LOGO_LENGTH) return false;
  // Uploaded logos are normalized to a PNG data URL by chooseLogo. Never
  // restore arbitrary URLs or SVG markup from an edited storage entry.
  return /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export function sanitizeStyle(value, defaults) {
  const result = { ...defaults };
  if (!isObject(value)) return result;
  for (const key of NUMBER_KEYS) {
    const next = value[key];
    if (typeof next === 'number' && Number.isFinite(next) && next >= 0 && next <= 100) result[key] = next;
  }
  for (const key of COLOR_KEYS) {
    const next = normalizeColor(value[key]);
    if (next) result[key] = next;
  }
  if (typeof value.gradient === 'boolean') result.gradient = value.gradient;
  if (['png', 'svg'].includes(value.format)) result.format = value.format;
  if (['L', 'M', 'Q', 'H'].includes(value.ecc)) result.ecc = value.ecc;
  if (value.logo === null || isLogo(value.logo)) result.logo = value.logo;
  return result;
}

export function readStyle(defaults, getStorage = browserStorage) {
  try {
    const raw = getStorage().getItem(STYLE_STORAGE_KEY);
    if (!raw || raw.length > MAX_RECORD_LENGTH) return { settings: { ...defaults }, error: '' };
    let record;
    try { record = JSON.parse(raw); } catch { return { settings: { ...defaults }, error: '' }; }
    const settings = isObject(record) && record.version === VERSION ? sanitizeStyle(record.settings, defaults) : { ...defaults };
    return { settings, error: '' };
  } catch {
    return { settings: { ...defaults }, error: STORAGE_ERROR };
  }
}

export function createStyleSaver(defaults, onError, getStorage = browserStorage, delay = 150) {
  let pending = null;
  let timer;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    try {
      const settings = sanitizeStyle(pending, defaults);
      getStorage().setItem(STYLE_STORAGE_KEY, JSON.stringify({ version: VERSION, settings }));
      pending = null;
      onError('');
    } catch {
      // Keep the latest value pending so a later edit or pagehide can retry.
      onError(STORAGE_ERROR);
    }
  };
  return {
    schedule(settings) {
      pending = settings;
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    dispose() { flush(); clearTimeout(timer); },
  };
}
