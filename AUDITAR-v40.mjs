import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || './web-v2');
const htmlFiles = fs.readdirSync(root)
  .filter(name => name.endsWith('.html'));

const missing = [];
const scanned = [];

function clean(value) {
  return String(value || '')
    .split('#')[0]
    .split('?')[0]
    .trim();
}

for (const name of htmlFiles) {
  const file = path.join(root,name);
  const html = fs.readFileSync(file,'utf8');

  const regex = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(html))) {
    const original = match[1];
    const value = clean(original);

    if (
      !value ||
      value.startsWith('#') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:') ||
      value.startsWith('javascript:') ||
      value.startsWith('data:')
    ) continue;

    const local = value.startsWith('/')
      ? path.resolve(root,'..',value.replace(/^\/web-v2\/?/,''))
      : path.resolve(path.dirname(file),value);

    scanned.push({page:name,reference:original});

    if (!fs.existsSync(local)) {
      missing.push({page:name,reference:original,resolved:local});
    }
  }
}

console.log(`Arcadia v40 — ${htmlFiles.length} páginas HTML revisadas.`);
console.log(`${scanned.length} referencias locales comprobadas.`);

if (!missing.length) {
  console.log('OK: no se detectaron archivos locales faltantes.');
  process.exit(0);
}

console.log(`AVISO: ${missing.length} referencia(s) local(es) no encontrada(s):`);
for (const row of missing) {
  console.log(`- ${row.page}: ${row.reference}`);
}

process.exitCode = 2;
