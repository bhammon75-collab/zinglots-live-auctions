import fs from 'fs'; import path from 'path';
const ROOTS = ['src','supabase/functions','supabase/migrations'];
const EXTS=/\.(tsx?|jsx?|sql|md|json|yml|yaml)$/i;
const PLACEHOLDER_LINE=/^\s*(?:\.{3}|…)(?:\s.*)?$/m;
const IN_WORD=/[A-Za-z0-9_](?:\.{3}|…)[A-Za-z0-9_]/;
const IGNORE_DIRS=new Set(['node_modules','dist','build','.next','coverage','.vercel','.output']);
let bad=[];
function walk(dir){ for(const name of fs.readdirSync(dir)){ const p=path.join(dir,name);
  const s=fs.statSync(p); if(s.isDirectory()){ if(!IGNORE_DIRS.has(name)) walk(p); continue; }
  if(!EXTS.test(name)) continue; const t=fs.readFileSync(p,'utf8');
  if(!t.includes('...') && !t.includes('…')) continue;
  if(PLACEHOLDER_LINE.test(t) || IN_WORD.test(t)){ const lines=t.split(/\r?\n/);
    const i1=lines.findIndex(l=>PLACEHOLDER_LINE.test(l)); const i2=lines.findIndex(l=>IN_WORD.test(l));
    const ln=(i1>=0?i1:i2)+1; bad.push(`${p}:${ln}`); } } }
for(const r of ROOTS){ if(fs.existsSync(r)) walk(r); }
if(bad.length){ console.error('Ellipsis corruption found:\n'+bad.join('\n')); process.exit(1); }
else{ console.log('No corruption-style ellipses found ✅'); }
