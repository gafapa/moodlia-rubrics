import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const extensionDir = join(projectRoot, 'extension');
const manifestPath = join(extensionDir, 'manifest.json');
const errors = [];

function assertFileExists(relativePath, label) {
  const filePath = join(extensionDir, relativePath.replace(/^\.\//, ''));

  if (!existsSync(filePath)) {
    errors.push(`${label} is missing: ${relativePath}`);
  }
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    errors.push('extension/manifest.json is missing.');
    return null;
  }

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(`extension/manifest.json is invalid JSON: ${error.message}`);
    return null;
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} is invalid JSON: ${error.message}`);
    return null;
  }
}

function validateManifest(manifest) {
  if (!manifest) return;

  if (manifest.manifest_version !== 3) {
    errors.push('manifest_version must be 3.');
  }

  if (!manifest.name) {
    errors.push('Manifest name is required.');
  }

  if (!manifest.version) {
    errors.push('Manifest version is required.');
  }

  const localesDir = join(extensionDir, '_locales');

  if (existsSync(localesDir) && !manifest.default_locale) {
    errors.push('Manifest default_locale is required when extension/_locales exists.');
  }

  for (const [index, contentScript] of (manifest.content_scripts ?? []).entries()) {
    if (!Array.isArray(contentScript.matches) || contentScript.matches.length === 0) {
      errors.push(`content_scripts[${index}].matches must include at least one URL pattern.`);
    }

    for (const cssPath of contentScript.css ?? []) {
      assertFileExists(cssPath, 'CSS file');
    }

    for (const jsPath of contentScript.js ?? []) {
      assertFileExists(jsPath, 'JavaScript file');
    }
  }

  for (const [size, iconPath] of Object.entries(manifest.icons ?? {})) {
    assertFileExists(iconPath, `${size}px icon`);
  }

  if (typeof manifest.background?.service_worker === 'string') {
    assertFileExists(manifest.background.service_worker, 'Background service worker');
  }

  if (typeof manifest.options_ui?.page === 'string') {
    assertFileExists(manifest.options_ui.page, 'Options page');
  }

  validateAction(manifest.action);

  validateManifestMessages(manifest);
}

function validateAction(action) {
  if (!action) return;

  if (typeof action.default_popup === 'string') {
    assertFileExists(action.default_popup, 'Action popup');
  }

  for (const [size, iconPath] of Object.entries(action.default_icon ?? {})) {
    assertFileExists(iconPath, `Action ${size}px icon`);
  }
}

function validateManifestMessages(manifest) {
  const defaultMessages = readLocaleMessages(manifest.default_locale);

  if (!defaultMessages) return;

  for (const [field, value] of Object.entries(manifest)) {
    if (typeof value === 'string') {
      validateMessageReference(value, `manifest.${field}`, defaultMessages);
    }
  }
}

function validateMessageReference(value, label, defaultMessages) {
  const matches = value.matchAll(/__MSG_([A-Za-z0-9_]+)__/g);

  for (const match of matches) {
    if (!defaultMessages[match[1]]) {
      errors.push(`${label} references missing locale message: ${match[1]}`);
    }
  }
}

function readLocaleMessages(locale) {
  if (!locale) return null;

  const messagesPath = join(extensionDir, '_locales', locale, 'messages.json');

  if (!existsSync(messagesPath)) {
    errors.push(`Default locale messages file is missing: _locales/${locale}/messages.json`);
    return null;
  }

  return readJson(messagesPath, `_locales/${locale}/messages.json`);
}

function validateLocales(manifest) {
  const localesDir = join(extensionDir, '_locales');

  if (!existsSync(localesDir)) return;

  const defaultMessages = readLocaleMessages(manifest?.default_locale);

  if (!defaultMessages) return;

  const defaultKeys = Object.keys(defaultMessages).sort();
  const localeDirs = readdirSync(localesDir)
    .map(name => join(localesDir, name))
    .filter(path => statSync(path).isDirectory());

  for (const localeDir of localeDirs) {
    const locale = localeDir.split(/[\\/]/).pop();
    const messagesPath = join(localeDir, 'messages.json');

    if (!existsSync(messagesPath)) {
      errors.push(`Locale ${locale} is missing messages.json.`);
      continue;
    }

    const messages = readJson(messagesPath, `_locales/${locale}/messages.json`);

    if (!messages) continue;

    validateLocaleMessages(locale, messages, defaultKeys);
  }
}

function validateLocaleMessages(locale, messages, defaultKeys) {
  const keys = Object.keys(messages).sort();
  const missingKeys = defaultKeys.filter(key => !keys.includes(key));
  const extraKeys = keys.filter(key => !defaultKeys.includes(key));

  for (const key of missingKeys) {
    errors.push(`Locale ${locale} is missing message key: ${key}`);
  }

  for (const key of extraKeys) {
    errors.push(`Locale ${locale} has unknown message key: ${key}`);
  }

  for (const [key, value] of Object.entries(messages)) {
    if (!value || typeof value.message !== 'string') {
      errors.push(`Locale ${locale} message ${key} must define a string message.`);
    }
  }
}

function validateJavaScriptSyntax() {
  const scriptPaths = [
    join(extensionDir, 'scripts', 'workbook.js'),
    join(extensionDir, 'scripts', 'rubric-model.js'),
    join(extensionDir, 'scripts', 'content.js'),
    join(extensionDir, 'scripts', 'host-access.js'),
    join(extensionDir, 'scripts', 'i18n.js'),
    join(extensionDir, 'scripts', 'service-worker.js'),
    join(extensionDir, 'options', 'options.js'),
    join(extensionDir, 'popup', 'popup.js'),
    join(extensionDir, 'whats-new', 'whats-new.js')
  ];

  for (const scriptPath of scriptPaths) {
    const result = spawnSync(process.execPath, ['--check', scriptPath], {
      encoding: 'utf8'
    });

    if (result.status !== 0) {
      const relativePath = scriptPath.replace(`${extensionDir}\\`, '').replace(/\\/g, '/');
      errors.push(result.stderr.trim() || `${relativePath} failed JavaScript syntax validation.`);
    }
  }
}

// The extension must not ask for site access at install time: it activates through activeTab
// or through per-site optional permissions granted by the user.
function validateLeastPrivilege(manifest) {
  if (!manifest) return;

  if (Array.isArray(manifest.host_permissions) && manifest.host_permissions.length > 0) {
    errors.push('host_permissions must be empty; request sites through optional_host_permissions.');
  }

  if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0) {
    errors.push('content_scripts must be empty; register them for granted sites or inject through activeTab.');
  }

  for (const pattern of manifest.optional_host_permissions ?? []) {
    if (!String(pattern).startsWith('https://')) {
      errors.push(`optional_host_permissions must be HTTPS only: ${pattern}`);
    }
  }
}

// Every data-i18n key used by an extension page must exist in the default locale.
function validatePageMessages(manifest) {
  const defaultMessages = readLocaleMessages(manifest?.default_locale);
  if (!defaultMessages) return;

  for (const page of ['popup/index.html', 'whats-new/index.html', 'options/index.html']) {
    const pagePath = join(extensionDir, page);
    if (!existsSync(pagePath)) {
      errors.push(`Extension page is missing: ${page}`);
      continue;
    }

    const html = readFileSync(pagePath, 'utf8');
    for (const match of html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) {
      if (!defaultMessages[match[1]]) {
        errors.push(`${page} references missing locale message: ${match[1]}`);
      }
    }
  }
}

const manifest = readManifest();
validateManifest(manifest);
validateLeastPrivilege(manifest);
validateLocales(manifest);
validatePageMessages(manifest);
validateJavaScriptSyntax();

if (errors.length > 0) {
  console.error('Extension validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Extension validation passed.');
