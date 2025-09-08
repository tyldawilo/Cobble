import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const candidates = [
  resolve(process.cwd(), '.supabase', 'dev', '.env'),
  resolve(process.cwd(), '.supabase', '.env'),
  resolve(process.cwd(), '.supabase', 'docker', '.env'),
];

const webEnvPath = resolve(process.cwd(), 'apps', 'web', '.env.local');

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const idx = l.indexOf('=');
        if (idx === -1) return [l, ''];
        return [l.slice(0, idx), l.slice(idx + 1)];
      })
  );
}

function pick(keys, map) {
  for (const k of keys) {
    if (map[k]) return map[k];
  }
  return undefined;
}

try {
  let envMap = {};
  let found = false;
  for (const p of candidates) {
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf8');
      envMap = parseEnv(raw);
      found = true;
      break;
    }
  }

  if (!found) {
    try {
      const out = execSync('supabase status --output env', { encoding: 'utf8' });
      envMap = parseEnv(out);
      found = true;
    } catch (e) {
      // ignore, fallback below
    }
  }

  if (!found) {
    throw new Error('Could not locate Supabase env. Ensure `supabase start` has run.');
  }

  const url =
    pick(['SUPABASE_URL', 'API_URL', 'NEXT_PUBLIC_SUPABASE_URL'], envMap) ||
    'http://127.0.0.1:54321';
  const anon = pick(['SUPABASE_ANON_KEY', 'ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'], envMap) || '';
  const content = `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\n`;
  writeFileSync(webEnvPath, content);
  console.log(`Wrote ${webEnvPath}`);
} catch (e) {
  console.error('Failed to link Supabase env to web:', e.message);
  process.exit(1);
}


