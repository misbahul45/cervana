#!/usr/bin/env node
// Build a static route catalog by parsing @Controller / @Get / @Post / @Patch / @Delete decorators
// in services/api/src. Source-only, no NestJS bootstrap.

const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '../src');
const OUT = path.resolve(__dirname, '../../../route-catalog.json');

const collect = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(full));
      continue;
    }
    if (!entry.name.endsWith('.controller.ts')) continue;
    out.push(full);
  }
  return out;
};

const stripQuotes = (s) => s.replace(/^['"`]|['"`]$/g, '');

const parseFile = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  // capture @Controller('prefix') per class
  const ctrlMatch = src.match(/@Controller\(\s*(['"`][^'"`]+['"`])?\s*\)/);
  const basePath = ctrlMatch ? stripQuotes(ctrlMatch[1] ?? '') : '';
  // capture @Module({ controllers: [X] }) — controllers/ exports list
  const lines = src.split('\n');
  const out = [];
  let curClassPath = basePath;
  for (let i = 0; i < lines.length; i++) {
    const ctrlLine = lines[i].match(/@Controller\(\s*(['"`]([^'"`]*)['"`])?\s*\)/);
    if (ctrlLine) {
      curClassPath = ctrlLine[2] ?? '';
      continue;
    }
    const m = lines[i].match(/^\s*@(Get|Post|Patch|Delete|Put|All)\(\s*(['"`]([^'"`]*)['"`])?\s*\)/);
    if (!m) continue;
    const method = m[1].toUpperCase();
    const sub = m[3] ?? '';
    const after = lines.slice(i + 1).join('\n');
    const handlerMatch = after.match(/^\s*(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(/);
    const handler = handlerMatch ? handlerMatch[1] : '?';
    let fullPath = curClassPath;
    if (sub) fullPath = fullPath ? `${fullPath}/${sub}` : sub;
    if (fullPath === '') fullPath = '/';
    out.push({
      file: path.relative(path.resolve(__dirname, '../../..'), file),
      method,
      path: fullPath,
      handler,
    });
  }
  return out;
};

const rows = [];
for (const f of collect(SRC_ROOT)) {
  rows.push(...parseFile(f));
}

const sorted = rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2));

const byMethod = sorted.reduce((acc, r) => { acc[r.method] = (acc[r.method] || 0) + 1; return acc; }, {});
console.log(JSON.stringify({ count: sorted.length, byMethod }));
