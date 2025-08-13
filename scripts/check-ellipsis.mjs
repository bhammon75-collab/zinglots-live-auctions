import fs from 'fs';
import path from 'path';

const ROOTS = ['src', 'supabase/functions', 'supabase/migrations'];
const EXTS = /(\.tsx?|\.jsx?|\.sql|\.md|\.json|\.yml|\.yaml)$/i;
const PLACEHOLDER_LINE = /^\s*(?:\.{3}|…)(?:\s.*)?$/m; // lines that begin with ... or …
const IN_WORD = /[A-Za-z0-9_](?:\.{3}|…)[A-Za-z0-9_]/;   // tex...t, clas…Name, etc.

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '.vercel', '.output']);
const IGNORE_FILES = new Set([]);

let bad: string[] = [];

function walk(dir: string) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(name)) walk(full);
      continue;
    }
    if (!EXTS.test(name) || IGNORE_FILES.has(name)) continue;
    const txt = fs.readFileSync(full, 'utf8');
    if (!txt.includes('...') && !txt.includes('…')) continue;

    const hasPlaceholder = PLACEHOLDER_LINE.test(txt);
    const hasInWord = IN_WORD.test(txt);

    if (hasPlaceholder || hasInWord) {
      const lines = txt.split(/\r?\n/);
      const idx1 = lines.findIndex((l) => PLACEHOLDER_LINE.test(l));
      const idx2 = lines.findIndex((l) => IN_WORD.test(l));
      const lineIdx = idx1 >= 0 ? idx1 : idx2;
      bad.push(`${full}:${lineIdx + 1}`);
    }
  }
}

for (const root of ROOTS) {
  if (fs.existsSync(root)) walk(root);
}

if (bad.length) {
  console.error('Ellipsis corruption found in:');
  console.error(bad.join('\n'));
  process.exit(1);
} else {
  console.log('No corruption-style ellipses found ✅');
}
