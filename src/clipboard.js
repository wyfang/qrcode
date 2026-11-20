import { svgToPngBlob } from './qr-design.js';

export function clipboardError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return '无法访问剪贴板，请允许浏览器复制，或下载文件。';
  }
  return error?.message || '复制失败，请重试或下载文件。';
}

// Call from the press handler without awaiting PNG generation first. Safari
// requires the clipboard write itself to start during the user's gesture.
export function copyQrPng(svg, size, filename) {
  if (!globalThis.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined'
    || (ClipboardItem.supports && !ClipboardItem.supports('image/png'))) {
    throw new Error('当前浏览器不支持复制 PNG，请使用 HTTPS 或下载 PNG。');
  }
  const image = svgToPngBlob(svg, size).then(blob => new File([blob], filename, { type: 'image/png' }));
  // A denied clipboard write can settle before the image promise does.
  image.catch(() => {});
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
}

export async function copyQrSvg(svg, filename) {
  if (!globalThis.isSecureContext || !navigator.clipboard?.writeText) {
    throw new Error('当前浏览器无法复制 SVG，请使用 HTTPS 或下载 SVG。');
  }
  // Supply both vector data and source when supported; receiving apps choose
  // their preferred representation. Older browsers get portable SVG source.
  if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined' && ClipboardItem.supports?.('image/svg+xml')) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'image/svg+xml': new File([svg],filename,{type:'image/svg+xml'}),
        'text/plain': new Blob([svg],{type:'text/plain'}),
      })]);
      return 'svg';
    } catch (error) {
      if (!['NotSupportedError','DataError'].includes(error?.name)) throw error;
    }
  }
  await navigator.clipboard.writeText(svg);
  return 'svg-text';
}
