import assert from 'node:assert/strict';
import test from 'node:test';
import { clipboardError, copyQrPng, copyQrSvg } from '../src/clipboard.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>';
const filename = 'example.com-20261120120132.svg';

function installBrowser(t, { secure = true, clipboard, Item } = {}) {
  const globals = { isSecureContext: secure, navigator: { clipboard }, ClipboardItem: Item };
  const original = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  t.after(() => {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

function clipboardFixture({ supported = true, nativeError, textError, supportsMethod = true } = {}) {
  const nativeWrites = [];
  const textWrites = [];
  class Item {
    constructor(data) {
      this.data = data;
      this.types = Object.keys(data);
    }
  }
  if (supportsMethod) Item.supports = type => supported && type === 'image/svg+xml';
  const clipboard = {
    async write(items) {
      nativeWrites.push(items);
      if (nativeError) throw nativeError;
    },
    async writeText(text) {
      textWrites.push(text);
      if (textError) throw textError;
    },
  };
  return { Item, clipboard, nativeWrites, textWrites };
}

test('SVG writes vector and source representations in one native clipboard item', async t => {
  const browser = clipboardFixture();
  installBrowser(t, browser);

  assert.equal(await copyQrSvg(svg, filename), 'svg');
  assert.equal(browser.nativeWrites.length, 1);
  assert.equal(browser.nativeWrites[0].length, 1);
  const [item] = browser.nativeWrites[0];
  assert.deepEqual(item.types, ['image/svg+xml', 'text/plain']);
  const image = item.data['image/svg+xml'];
  assert.ok(image instanceof File);
  assert.equal(image.name, filename);
  assert.equal(image.type, 'image/svg+xml');
  assert.equal(await image.text(), svg);
  assert.equal(item.data['text/plain'].type, 'text/plain');
  assert.equal(await item.data['text/plain'].text(), svg);
  assert.deepEqual(browser.textWrites, []);
});

test('SVG falls back directly to source text when its image MIME type is unsupported', async t => {
  const browser = clipboardFixture({ supported: false });
  installBrowser(t, browser);

  assert.equal(await copyQrSvg(svg, filename), 'svg-text');
  assert.deepEqual(browser.nativeWrites, []);
  assert.deepEqual(browser.textWrites, [svg]);
});

test('SVG source text works when native write or ClipboardItem is unavailable', async t => {
  await t.test('no native write', async t => {
    const textWrites = [];
    installBrowser(t, { clipboard: { async writeText(value) { textWrites.push(value); } } });
    assert.equal(await copyQrSvg(svg, filename), 'svg-text');
    assert.deepEqual(textWrites, [svg]);
  });
  await t.test('no ClipboardItem', async t => {
    const browser = clipboardFixture();
    installBrowser(t, { ...browser, Item: undefined });
    assert.equal(await copyQrSvg(svg, filename), 'svg-text');
    assert.deepEqual(browser.nativeWrites, []);
    assert.deepEqual(browser.textWrites, [svg]);
  });
  await t.test('no MIME support probe', async t => {
    const browser = clipboardFixture({ supportsMethod: false });
    installBrowser(t, browser);
    assert.equal(await copyQrSvg(svg, filename), 'svg-text');
    assert.deepEqual(browser.nativeWrites, []);
    assert.deepEqual(browser.textWrites, [svg]);
  });
});

test('unsupported native SVG errors fall back to source text', async t => {
  for (const name of ['NotSupportedError', 'DataError']) {
    await t.test(name, async t => {
      const browser = clipboardFixture({ nativeError: new DOMException('Unsupported vector clipboard data', name) });
      installBrowser(t, browser);
      assert.equal(await copyQrSvg(svg, filename), 'svg-text');
      assert.equal(browser.nativeWrites.length, 1);
      assert.deepEqual(browser.textWrites, [svg]);
    });
  }
});

test('permission failures and unexpected native errors propagate without text fallback', async t => {
  for (const name of ['NotAllowedError', 'SecurityError', 'AbortError']) {
    await t.test(name, async t => {
      const error = new DOMException('Clipboard write was not permitted', name);
      const browser = clipboardFixture({ nativeError: error });
      installBrowser(t, browser);
      await assert.rejects(copyQrSvg(svg, filename), value => value === error);
      assert.equal(browser.nativeWrites.length, 1);
      assert.deepEqual(browser.textWrites, []);
    });
  }
});

test('a rejected SVG text fallback is not reported as a successful copy', async t => {
  const error = new DOMException('Clipboard text write was not permitted', 'NotAllowedError');
  const browser = clipboardFixture({ supported: false, textError: error });
  installBrowser(t, browser);
  await assert.rejects(copyQrSvg(svg, filename), value => value === error);
  assert.deepEqual(browser.nativeWrites, []);
  assert.deepEqual(browser.textWrites, [svg]);
});

test('insecure SVG contexts and missing text APIs return actionable errors', async t => {
  await t.test('insecure context', async t => {
    const browser = clipboardFixture();
    installBrowser(t, { ...browser, secure: false });
    await assert.rejects(copyQrSvg(svg, filename), /HTTPS.*下载 SVG/);
    assert.deepEqual(browser.nativeWrites, []);
    assert.deepEqual(browser.textWrites, []);
  });
  await t.test('no clipboard API', async t => {
    installBrowser(t);
    await assert.rejects(copyQrSvg(svg, filename), /HTTPS.*下载 SVG/);
  });
  await t.test('no writeText API', async t => {
    let wrote = false;
    installBrowser(t, { clipboard: { async write() { wrote = true; } } });
    await assert.rejects(copyQrSvg(svg, filename), /HTTPS.*下载 SVG/);
    assert.equal(wrote, false);
  });
});

test('PNG capability failures are actionable before any image conversion begins', async t => {
  const capableItem = class { static supports() { return true; } };
  const cases = [
    { name: 'insecure context', secure: false, Item: capableItem, clipboard: { write() {} } },
    { name: 'no clipboard API', Item: capableItem },
    { name: 'no native write API', Item: capableItem, clipboard: { writeText() {} } },
    { name: 'no ClipboardItem', clipboard: { write() {} } },
    { name: 'PNG MIME unsupported', Item: class { static supports() { return false; } }, clipboard: { write() {} } },
  ];
  for (const item of cases) {
    await t.test(item.name, t => {
      installBrowser(t, item);
      assert.throws(() => copyQrPng(svg, 64, 'example.png'), /HTTPS.*下载 PNG/);
    });
  }
});

test('clipboard error copy distinguishes permission failures and preserves useful errors', () => {
  for (const name of ['NotAllowedError', 'SecurityError']) {
    assert.match(clipboardError({ name }), /允许浏览器复制.*下载文件/);
  }
  assert.equal(clipboardError(new Error('An actionable conversion error')), 'An actionable conversion error');
  assert.match(clipboardError(), /复制失败.*下载文件/);
});
