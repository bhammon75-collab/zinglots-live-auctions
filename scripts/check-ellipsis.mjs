// flags only corruption-style ellipses (placeholder lines or in-word breaks), ignores spreads/rest
import fs from 'fs';
import path from 'path';

const ROOTS = ['src', 'supabase/functions', 'supabase/migrations'];
const EXTS = /\.(tsx?|jsx?|sql|md|json|yml|yaml)$/i;
const PLACEHOLDER_LINE = /^\s*(?:\.{3}|…)(?:\s.*)?$/m; // lines that begin with ... or …
const IN_WORD = /[A-Za-z0-9_](?:\.{3}|…)[A-Za-z0-9_]/; // e.g. tex...t, clas…s

const IGNORE_DIRS = new Set(['node_modules','dist','build','.next','coverage','.vercel','.output']);
const IGNORE_FILES = new Set([]);

let bad = [];

function walk(dir){
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { if (!IGNORE_DIRS.has(name)) walk(full); continue; }
    if (!EXTS.test(name) || IGNORE_FILES.has(name)) continue;
    const txt = fs.readFileSync(full, 'utf8');
    if (!txt.includes('...') && !txt.includes('…')) continue;

    const hasPlaceholder = PLACEHOLDER_LINE.test(txt);
    const hasInWord = IN_WORD.test(txt);

    if (hasPlaceholder || hasInWord) {
      const lines = txt.split(/\r?\n/);
      const i1 = lines.findIndex(l => PLACEHOLDER_LINE.test(l));
      const i2 = lines.findIndex(l => IN_WORD.test(l));
      const line = (i1 >= 0 ? i1 : i2) + 1;
      bad.push(`${full}:${line}`);
    }
  }
}

for (const root of ROOTS) { if (fs.existsSync(root)) walk(root); }

if (bad.length) {
  console.error('Ellipsis corruption found:\n' + bad.join('\n'));
  process.exit(1);
} else {
  console.log('No corruption-style ellipses found ✅');
}

}
