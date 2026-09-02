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
    'https://campus.example.edu/moodle/grade/grading/form/rubric/edit.php*',
    'https://campus.example.edu/moodle/mod/workshop/editform.php*'
  ]);
  assert.throws(() => access.normalizeInput('http://campus.example.edu'), /Only HTTPS/);
});

test('host access recognizes Workshop rubric URLs and built-in nested Moodle paths', async () => {
  const sandbox = { URL };
  await evaluate('extension/scripts/host-access.js', sandbox);
  const access = sandbox.RubricandoHostAccess;
  const site = access.normalizeInput('https://campus.example.edu/moodle/mod/workshop/editform.php?cmid=12705');

  assert.equal(site.basePath, '/moodle');
  assert.deepEqual(Array.from(access.buildMatches(site)), [
    'https://campus.example.edu/moodle/grade/grading/form/rubric/edit.php*',
    'https://campus.example.edu/moodle/mod/workshop/editform.php*'
  ]);

  const builtInMatches = access.getBuiltInSites()[0].matches;
  assert.ok(builtInMatches.includes('https://www.edu.xunta.gal/mod/workshop/editform.php*'));
  assert.ok(builtInMatches.includes('https://www.edu.xunta.gal/*/mod/workshop/editform.php*'));
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

test('rubric model maps paired CSV rows to criteria and levels', async () => {
  const sandbox = {};
  await evaluate('extension/scripts/rubric-model.js', sandbox);
  const model = sandbox.RubricImportModel.fromSheet({
    A1: { v: 'Argument' },
    B1: { v: 'Needs work' },
    C1: { v: 'Excellent' },
    B2: { v: 0 },
    C2: { v: 10 },
    A3: { v: 'Evidence' },
    B3: { v: 'Missing' },
    C3: { v: 'Complete' },
    B4: { v: 0 },
    C4: { v: 8 }
  });

  assert.equal(model.criteria.length, 2);
  assert.equal(model.criteria[0].description, 'Argument');
  assert.deepEqual(
    Array.from(model.criteria[0].levels, level => ({ ...level })),
    [
      { definition: 'Needs work', grade: 0 },
      { definition: 'Excellent', grade: 10 }
    ]
  );
});

test('Workshop rubric validation enforces integer, unique grades from 0 to 100', async () => {
  const sandbox = {};
  await evaluate('extension/scripts/rubric-model.js', sandbox);
  const validate = sandbox.RubricImportModel.validateWorkshop;

  assert.deepEqual({ ...validate({ criteria: [{ levels: [{ grade: 0 }, { grade: 100 }] }] }) }, { valid: true });
  assert.deepEqual(
    { ...validate({ criteria: [{ levels: [{ grade: 5 }, { grade: 5 }] }] }) },
    { valid: false, criterionNumber: 1 }
  );
  assert.deepEqual(
    { ...validate({ criteria: [{ levels: [{ grade: 2.5 }] }] }) },
    { valid: false, criterionNumber: 1 }
  );
  assert.deepEqual(
    { ...validate({ criteria: [{ levels: [{ grade: 101 }] }] }) },
    { valid: false, criterionNumber: 1 }
  );
});

test('rubric model rejects missing level grades before changing Moodle', async () => {
  const sandbox = {};
  await evaluate('extension/scripts/rubric-model.js', sandbox);

  assert.throws(() => sandbox.RubricImportModel.fromSheet({
    A1: { v: 'Criterion' },
    B1: { v: 'Level without grade' }
  }), /does not have a grade/);
});

async function evaluate(relativePath, sandbox) {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: relativePath });
}
