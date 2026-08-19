#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const value = name => {
  const flag = process.argv.indexOf(`--${name}`);
  return flag >= 0 ? process.argv[flag + 1] : undefined;
};

let token;
try {
  token = execFileSync('security', ['find-generic-password', '-w', '-s', 'pressforgoblins-goblin-stats', '-a', 'noah'], { encoding:'utf8' }).trim();
} catch {
  process.stderr.write('Goblin Stats credential is unavailable.\n');
  process.exit(2);
}

const url = new URL('https://pressforgoblins.com/api/goblin-stats');
for (const name of ['days','minutes','limit']) if (value(name)) url.searchParams.set(name, value(name));
const response = await fetch(url, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' } });
if (!response.ok) {
  process.stderr.write(`Goblin Stats request failed (${response.status}).\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
