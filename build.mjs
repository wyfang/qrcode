import { build, transform } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { mkdir, copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

await mkdir('dist', { recursive: true });
const bundle = await build({entryPoints:['src/App.jsx'],bundle:true,minify:true,outfile:'dist/app.js',platform:'browser',target:['es2020'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof',metafile:true});
const css=await postcss([tailwind({base:process.cwd()})]).process(await readFile('src/styles.css','utf8'),{from:'src/styles.css'});
await writeFile('dist/app.css',(await transform(css.css,{loader:'css',minify:true})).code);
await copyFile('src/index.html','dist/index.html');
await copyFile('src/favicon.svg','dist/favicon.svg');

function packageRoot(input) {
  const segments = input.replaceAll('\\', '/').split('/');
  const index = segments.lastIndexOf('node_modules');
  if (index === -1) return null;
  const count = segments[index + 1]?.startsWith('@') ? 2 : 1;
  return segments.slice(0, index + 1 + count).join('/');
}

// Only packages that contribute bytes are distributed in the JS bundle.
// CSS packages are included explicitly because PostCSS is outside esbuild's graph.
const packageRoots = new Set(['node_modules/tailwindcss', 'node_modules/@heroui/styles']);
for (const output of Object.values(bundle.metafile.outputs)) {
  for (const [input, details] of Object.entries(output.inputs)) {
    if (details.bytesInOutput <= 0) continue;
    const root = packageRoot(input);
    if (root) packageRoots.add(root);
  }
}

const notices = [];
for (const root of [...packageRoots].sort()) {
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  // Inspect only each exact package root, preserving all supplied license and
  // notice files rather than traversing dependency trees or guessing ownership.
  const entries = await readdir(root, { withFileTypes: true });
  const licenseNames = entries.filter(entry => entry.isFile() && /^licen[cs]e(?:[.-].+)?$/i.test(entry.name)).map(entry => entry.name).sort();
  const noticeNames = entries.filter(entry => entry.isFile() && /^notice(?:[.-].+)?$/i.test(entry.name)).map(entry => entry.name).sort();
  if (!licenseNames.length) throw new Error(`Missing license file for ${metadata.name}@${metadata.version}`);
  const sections = [];
  for (const name of [...licenseNames, ...noticeNames]) {
    const text = await readFile(path.join(root, name), 'utf8');
    if (!text.trim()) throw new Error(`Empty legal file: ${root}/${name}`);
    sections.push(`${name}\n\n${text.trimEnd()}`);
  }
  const license = typeof metadata.license === 'string' ? ` — ${metadata.license}` : '';
  notices.push(`${metadata.name}@${metadata.version}${license}\n${'='.repeat(72)}\n\n${sections.join('\n\n')}`);
}
const licenses = notices.join('\n\n') + '\n';
await writeFile('THIRD-PARTY-LICENSES.txt', licenses);
await writeFile('dist/THIRD-PARTY-LICENSES.txt', licenses);
await copyFile('LICENSE', 'dist/LICENSE');
await copyFile('NOTICE', 'dist/NOTICE');
console.log('Built static frontend in dist/');
