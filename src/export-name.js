const encoder = new TextEncoder();
const MAX_STEM_POINTS = 32;
const MAX_STEM_BYTES = 64;
const RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/iu;

function contentStem(kind, content) {
  if (kind === 'url') {
    try {
      // hostname excludes credentials, port, path, query and fragment.
      return new URL(content?.url).hostname.replace(/^www\./i, '');
    } catch {
      return '';
    }
  }
  if (kind === 'text') return content?.text;
  if (kind === 'wifi') return content?.ssid;
  return '';
}

function safeStem(value) {
  let cleaned = (typeof value === 'string' ? value : '').normalize('NFC')
    .replace(/[<>:"/\\|?*\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+/gu, '-')
    .replace(/\s+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[. -]+|[. -]+$/g, '');
  if (RESERVED_DEVICE_NAME.test(cleaned)) cleaned = `qrcode-${cleaned}`;

  let result = '';
  let points = 0;
  let bytes = 0;
  // Iterating a string preserves surrogate pairs. Skip existing lone surrogates
  // instead of leaving the browser or filesystem to replace malformed UTF-16.
  for (const point of cleaned) {
    const code = point.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const length = encoder.encode(point).length;
    if (points >= MAX_STEM_POINTS || bytes + length > MAX_STEM_BYTES) break;
    result += point;
    points += 1;
    bytes += length;
  }
  return result.replace(/[. -]+$/g, '') || 'qrcode';
}

function localTimestamp(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new RangeError('A valid export date is required.');
  }
  const year = date.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('Export year must be between 0000 and 9999.');
  return [year, date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('');
}

export function buildExportFilename({ kind, content = {}, format = 'png', date = new Date() } = {}) {
  const extension = format === 'svg' ? 'svg' : 'png';
  return `${safeStem(contentStem(kind, content))}-${localTimestamp(date)}.${extension}`;
}
