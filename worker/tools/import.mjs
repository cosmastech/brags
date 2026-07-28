#!/usr/bin/env node
/**
 * One-time importer: bragbook-data JSONL + story markdown -> hosted API.
 *
 * Usage:
 *   BRAG_API_URL=http://localhost:8787 BRAG_TOKEN=dev-token node tools/import.mjs
 *   BRAG_API_URL=https://brags.example.workers.dev BRAG_TOKEN=... node tools/import.mjs --dir ~/bragbook-data
 *
 * Writes go through the API on purpose: the same validation that guards
 * agents guards the import. Everything aborts loudly on bad data.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const args = process.argv.slice(2);
const dirFlagIdx = args.indexOf('--dir');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const HOME =
  dirFlagIdx !== -1
    ? resolve(args[dirFlagIdx + 1])
    : process.env.BRAG_HOME
      ? resolve(process.env.BRAG_HOME)
      : resolve(scriptDir, '../../../bragbook-data');

const BASE = process.env.BRAG_API_URL?.replace(/\/$/, '');
const TOKEN = process.env.BRAG_TOKEN;
if (!BASE || !TOKEN) {
  console.error('Set BRAG_API_URL and BRAG_TOKEN.');
  process.exit(1);
}
if (!existsSync(HOME)) {
  console.error(`Warehouse directory not found: ${HOME}`);
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, body: json };
}

function collect(dir, ext) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(p, ext));
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out.sort();
}

const failures = [];
const expected = { records: 0, evidence: 0, behavioral: 0, stories: 0 };

async function importJsonl(file, state) {
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  for (const [i, line] of lines.entries()) {
    let record;
    try {
      record = JSON.parse(line);
    } catch (e) {
      failures.push(`${file}:${i + 1} invalid JSON: ${e.message}`);
      continue;
    }
    const res = await api('POST', '/brags', { ...record, state });
    if (res.ok) {
      expected.records += 1;
      expected.evidence += record.evidence?.length ?? 0;
      expected.behavioral += record.behavioral_evidence?.length ?? 0;
      console.log(`  ${res.body.created ? 'created' : 'updated'} ${record.id}`);
    } else {
      failures.push(`${record.id ?? `${file}:${i + 1}`} -> ${res.status} ${JSON.stringify(res.body)}`);
    }
  }
}

function parseStory(file) {
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error('missing frontmatter');
  const fm = YAML.parse(match[1]);
  const body = raw.slice(match[0].length);
  const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? undefined : String(v));
  return {
    id: String(fm.id),
    title: String(fm.title),
    date: iso(fm.date),
    status: fm.status ?? 'draft',
    dimensions: fm.dimensions ?? [],
    behaviors: fm.behaviors ?? [],
    last_reviewed_at: fm.last_reviewed_at ? String(fm.last_reviewed_at) : undefined,
    source_brag_ids: fm.source_brag_ids ?? [],
    body_md: body,
  };
}

async function importStory(file) {
  let story;
  try {
    story = parseStory(file);
  } catch (e) {
    failures.push(`${file}: ${e.message}`);
    return;
  }
  const res = await api('POST', '/stories', story);
  if (res.ok) {
    expected.stories += 1;
    console.log(`  ${res.body.created ? 'created' : 'updated'} story ${story.id}`);
  } else {
    failures.push(`story ${story.id} -> ${res.status} ${JSON.stringify(res.body)}`);
  }
}

console.log(`Importing from ${HOME}`);
console.log(`Target: ${BASE}\n`);

for (const file of collect(join(HOME, 'inbox'), '.jsonl')) {
  console.log(`inbox: ${file}`);
  await importJsonl(file, 'inbox');
}
for (const file of collect(join(HOME, 'entries'), '.jsonl')) {
  console.log(`entries: ${file}`);
  await importJsonl(file, 'active');
}
for (const file of collect(join(HOME, 'stories'), '.md')) {
  console.log(`story: ${file}`);
  await importStory(file);
}

console.log('\n--- Verification ---');
const doc = await api('GET', '/doctor');
if (!doc.ok) {
  failures.push(`/doctor failed: ${doc.status} ${JSON.stringify(doc.body)}`);
} else {
  const d = doc.body;
  const actual = {
    records: d.brags.total,
    evidence: d.evidence,
    behavioral: d.behavioral_evidence,
    stories: d.stories.total,
  };
  for (const key of Object.keys(expected)) {
    const pass = expected[key] === actual[key];
    console.log(`${pass ? 'PASS' : 'FAIL'} ${key}: expected ${expected[key]}, got ${actual[key]}`);
    if (!pass) failures.push(`count mismatch on ${key}`);
  }
  const issueEntries = Object.entries(d.issues ?? {}).filter(([, n]) => n > 0);
  if (issueEntries.length) failures.push(`doctor issues: ${JSON.stringify(Object.fromEntries(issueEntries))}`);
  console.log(`doctor ok: ${d.ok}`);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nImport complete and verified.');
