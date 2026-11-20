import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { buildExportFilename } from '../src/export-name.js';

const date = new Date(2026, 10, 20, 12, 1, 32);
const suffix = '-20261120120132.png';
const filename = (kind, content, extra = {}) => buildExportFilename({ kind, content, date, ...extra });
const stem = value => value.slice(0, -suffix.length);

test('default URL produces the requested readable filename', () => {
  assert.equal(filename('url', { url: 'https://wyfang.net' }), 'wyfang.net-20261120120132.png');
});

test('URL names exclude credentials, port, path, query and fragment', () => {
  const name = filename('url', { url: 'https://private:password@www.Example.com:8443/private/file?token=secret#private' });
  assert.equal(name, `example.com${suffix}`);
  assert.doesNotMatch(name, /password|private|token|secret|8443/);
  assert.equal(filename('url', { url: 'not a URL?password=secret' }), `qrcode${suffix}`);
});

test('text and Wi-Fi names preserve Chinese and use no Wi-Fi secret', () => {
  assert.equal(filename('text', { text: '你好 世界' }), `你好-世界${suffix}`);
  assert.equal(filename('wifi', { ssid: '办公室网络', password: 'never-export-this-password', security: 'WPA' }), `办公室网络${suffix}`);
});

test('forbidden characters, controls, hidden-file prefixes and trailing dots are removed', () => {
  const name = filename('text', { text: '... a/b\\c:*?"<>|d\u0000\n\u007f\u202e .  ' });
  assert.equal(name, `a-b-c-d${suffix}`);
  assert.doesNotMatch(stem(name), /[<>:"/\\|?*\p{Cc}\u202e]/u);
  assert.doesNotMatch(stem(name), /^[. ]|[. ]$/);
  assert.equal(filename('text', { text: '....' }), `qrcode${suffix}`);
  assert.equal(filename('text', { text: '\u0000\u0001\t' }), `qrcode${suffix}`);
});

test('reserved Windows device names receive a safe prefix', () => {
  for (const value of ['CON', 'prn', 'Aux.txt', 'NUL...', 'COM1', 'lpt9', 'COM¹', 'LPT³']) {
    assert.match(stem(filename('text', { text: value })), /^qrcode-/);
  }
  assert.equal(filename('text', { text: 'console' }), `console${suffix}`);
});

test('ASCII and Unicode limits keep whole code points within 64 UTF-8 bytes', () => {
  assert.equal(stem(filename('text', { text: 'a'.repeat(100) })), 'a'.repeat(32));
  const chinese = stem(filename('text', { text: '汉'.repeat(100) }));
  assert.equal(chinese, '汉'.repeat(21));
  const emoji = stem(filename('text', { text: '😀'.repeat(100) }));
  assert.equal(emoji, '😀'.repeat(16));
  assert.ok(new TextEncoder().encode(emoji).length <= 64);
  assert.ok([...emoji].length <= 32);
  assert.ok(new TextEncoder().encode(filename('text', { text: '😀'.repeat(100) })).length <= 83);
});

test('truncation cleans a newly trailing dot and skips lone surrogates', () => {
  assert.equal(stem(filename('text', { text: `${'a'.repeat(31)}.continued` })), 'a'.repeat(31));
  assert.equal(filename('text', { text: '\ud800好\udfff😀' }), `好😀${suffix}`);
});

test('canonical normalization preserves readable composed Unicode', () => {
  assert.equal(filename('text', { text: 'Cafe\u0301' }), `Café${suffix}`);
});

test('missing or empty input falls back without leaking another content field', () => {
  assert.equal(filename('wifi', { ssid: '', password: 'secret' }), `qrcode${suffix}`);
  assert.equal(filename('url', { url: '', text: 'private' }), `qrcode${suffix}`);
  assert.equal(filename('text', null), `qrcode${suffix}`);
  assert.equal(filename('unknown', { text: 'private' }), `qrcode${suffix}`);
});

test('extension is limited to PNG and SVG', () => {
  assert.equal(filename('url', { url: 'https://wyfang.net' }, { format: 'svg' }), 'wyfang.net-20261120120132.svg');
  assert.equal(filename('url', { url: 'https://wyfang.net' }, { format: '../private' }), `wyfang.net${suffix}`);
});

test('local calendar fields are zero-padded, including years below 100', () => {
  const early = new Date(2026, 0, 2, 3, 4, 5);
  early.setFullYear(9);
  assert.equal(filename('text', { text: 'sample' }, { date: early }), 'sample-00090102030405.png');
});

test('timestamp uses the browser local zone rather than UTC', () => {
  const moduleURL = new URL('../src/export-name.js', import.meta.url).href;
  const script = `import {buildExportFilename} from ${JSON.stringify(moduleURL)}; process.stdout.write(buildExportFilename({kind:'text', content:{text:'sample'}, date:new Date('2026-11-20T00:01:02Z')}));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(output, 'sample-20261119160102.png');
});

test('invalid dates do not silently produce malformed timestamps', () => {
  assert.throws(() => filename('text', { text: 'sample' }, { date: new Date(NaN) }), RangeError);
});
