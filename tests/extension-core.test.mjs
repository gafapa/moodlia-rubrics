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

test('host access recognizes Workshop rubric URLs on any Moodle base path', async () => {
  const sandbox = { URL };
  await evaluate('extension/scripts/host-access.js', sandbox);
  const access = sandbox.RubricandoHostAccess;
  const site = access.normalizeInput('https://campus.example.edu/moodle/mod/workshop/editform.php?cmid=12705');

  assert.equal(site.basePath, '/moodle');
  assert.deepEqual(Array.from(access.buildMatches(site)), [
    'https://campus.example.edu/moodle/grade/grading/form/rubric/edit.php*',
    'https://campus.example.edu/moodle/mod/workshop/editform.php*'
  ]);
});

test('rubric pages are recognized on any HTTPS Moodle, and nothing else is', async () => {
  const sandbox = { URL };
  await evaluate('extension/scripts/host-access.js', sandbox);
  const access = sandbox.RubricandoHostAccess;

  for (const url of [
    'https://campus.example.edu/grade/grading/form/rubric/edit.php?areaid=4',
    'https://www.edu.xunta.gal/centros/ies/aulavirtual/mod/workshop/editform.php?cmid=12',
    'https://moodle.example.org/moodle/mod/workshop/editform.php'
  ]) {
    assert.equal(access.isRubricPageUrl(url), true, url);
  }
  for (const url of [
    'http://campus.example.edu/grade/grading/form/rubric/edit.php',
    'https://campus.example.edu/course/view.php?id=2',
    'https://campus.example.edu/grade/grading/form/rubric/edit.php.bak',
    'chrome://extensions/',
    '',
    undefined
  ]) {
    assert.equal(access.isRubricPageUrl(url), false, String(url));
  }
});

test('host access removes duplicates and insecure entries from stored sites', async () => {
  const sandbox = { URL };
  await evaluate('extension/scripts/host-access.js', sandbox);
  const access = sandbox.RubricandoHostAccess;
  const custom = access.normalizeInput('https://campus.example.edu/moodle');
  const xunta = access.normalizeInput('https://www.edu.xunta.gal/grade/grading/form/rubric/edit.php');
  const normalized = access.normalizeStoredSites([custom, custom, xunta, { id: 'bad', originPattern: 'http://bad.test/*' }]);

  assert.deepEqual(Array.from(normalized, site => site.id), [custom.id, xunta.id]);
});

test('the manifest asks for no site access at install time', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));

  assert.ok(manifest.permissions.includes('activeTab'));
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
  assert.equal(manifest.action.default_popup, 'popup/index.html');
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

test('people updating from before 1.2.0 see the what\'s-new page once; new installs and later updates do not', async () => {
  async function openedTabsFor(details) {
    const listeners = {};
    const event = (name) => ({ addListener: (listener) => { listeners[name] = listener; } });
    const opened = [];
    const sandbox = {
      importScripts() {},
      console,
      RubricandoHostAccess: { syncRegisteredSites: async () => [], storageArea: 'local', storageKey: 'allowedMoodleSites' },
      chrome: {
        runtime: { onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message'), getURL: (file) => `chrome-extension://id/${file}` },
        storage: { onChanged: event('storage') },
        permissions: { onAdded: event('added'), onRemoved: event('removed') },
        tabs: { create: async (options) => { opened.push(options.url); } }
      }
    };
    await evaluate('extension/scripts/service-worker.js', sandbox);
    listeners.installed(details);
    await new Promise((resolve) => setImmediate(resolve));
    return opened;
  }

  assert.deepEqual(await openedTabsFor({ reason: 'update', previousVersion: '1.1.0' }), ['chrome-extension://id/whats-new/index.html']);
  assert.deepEqual(await openedTabsFor({ reason: 'update', previousVersion: '1.0.21' }), ['chrome-extension://id/whats-new/index.html']);
  assert.deepEqual(await openedTabsFor({ reason: 'update', previousVersion: '1.2.0' }), []);
  assert.deepEqual(await openedTabsFor({ reason: 'update', previousVersion: '1.3.0' }), []);
  assert.deepEqual(await openedTabsFor({ reason: 'install' }), []);
  assert.deepEqual(await openedTabsFor({ reason: 'chrome_update', previousVersion: '1.1.0' }), []);
});

async function evaluate(relativePath, sandbox) {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: relativePath });
}
