#!/usr/bin/env node
/* Builds dist/10-billion-years.standalone.html — a single self-contained file
   (Three.js + engine + styles inlined). Google Fonts stay as an external link
   and degrade gracefully offline. Node built-ins only. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

let html = read('index.html');

// inline local stylesheet(s) marked data-inline (?v= stamps stripped for fs reads)
html = html.replace(
  /<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?" data-inline\s*\/?>/g,
  (_, href) => '<style>\n' + read(href) + '\n</style>'
);

// inline local scripts marked data-inline; guard any </script sequences
const safeJS = (src) => src.replace(/<\/script/gi, '<\\/script');
html = html.replace(
  /<script src="([^"?]+)(?:\?[^"]*)?" data-inline><\/script>/g,
  (_, src) => '<script>\n' + safeJS(read(src)) + '\n</script>'
);

mkdirSync(resolve(root, 'dist'), { recursive: true });
const out = resolve(root, 'dist/10-billion-years.standalone.html');
writeFileSync(out, html);

const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log(`built dist/10-billion-years.standalone.html (${kb} KB)`);
if (/data-inline/.test(html.replace(/data-inline-skip/g, ''))) {
  console.error('WARN: un-inlined data-inline reference remains');
  process.exitCode = 1;
}
