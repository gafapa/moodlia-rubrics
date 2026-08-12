import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('CSV parser detects delimiters, quoted fields, and scalar values', async () => {
  const sandbox = { window: {}, TextDecoder, URL };
  await evaluate('extension/scripts/workbook.js', sandbox);
  const csv = 'Criterion;"Excellent; complete";10\r\nSecond;"Quoted ""value""";7.5';
  const sheet = await sandbox.window.RubricWorkbookParser.parse('rubric.csv', new TextEncoder().encode(csv));

  assert.equal(sheet.A1.v, 'Criterion');
  assert.equal(sheet.B1.v, 'Excellent; complete');
  assert.equal(sheet.C1.v, 10);
  assert.equal(sheet.B2.v, 'Quoted "value"');
  assert.equal(sheet.C2.v, 7.5);
});

test('CSV parser rejects unsupported workbook formats', async () => {
  const sandbox = { window: {}, TextDecoder, URL };
  await evaluate('extension/scripts/workbook.js', sandbox);
  await assert.rejects(() => sandbox.window.RubricWorkbookParser.parse('rubric.xlsx', new Uint8Array()), /Unsupported/);
});

test('host access normalizes Moodle base paths and rejects insecure hosts', async () => {
  const sandbox = { URL };
  await evaluate('extension/scripts/host-access.js', sandbox);
  const access = sandbox.RubricandoHostAccess;
  const site = access.normalizeInput('campus.example.edu/moodle/grade/grading/form/rubric/edit.php?id=3');

  assert.equal(site.originPattern, 'https://campus.example.edu/*');
  assert.equal(site.basePath, '/moodle');
  assert.deepEqual(Array.from(access.buildMatches(site)), [
    'https://campus.example.edu/moodle/grade/grading/form/rubric/edit.php*'
  ]);
  assert.throws(() => access.normalizeInput('http://campus.example.edu'), /Only HTTPS/);
});

test('host access removes duplicates and built-in sites from stored custom sites', async () => {
  const sandbox = { URL };
  await evaluate('extension/scripts/host-access.js', sandbox);
  const access = sandbox.RubricandoHostAccess;
  const custom = access.normalizeInput('https://campus.example.edu/moodle');
  const builtIn = access.getBuiltInSites()[0];
  const normalized = access.normalizeStoredSites([custom, custom, builtIn, { id: 'bad', originPattern: 'http://bad.test/*' }]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, custom.id);
});

async function evaluate(relativePath, sandbox) {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: relativePath });
}
