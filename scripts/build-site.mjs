import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const webDir = join(projectRoot, 'web');
const distDir = join(projectRoot, 'dist');
const extensionDir = join(projectRoot, 'extension');
const manifest = JSON.parse(readFileSync(join(extensionDir, 'manifest.json'), 'utf8'));
const chromeWebStoreUrl = 'https://chromewebstore.google.com/detail/rubricando-para-moodle/ohicmoijcdaddlljgoaoocpjamfnmpgl';
const iconFiles = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png'];

function copyDirectory(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });

  for (const item of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, item);
    const targetPath = join(targetDir, item);

    if (statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
}

if (!existsSync(webDir)) {
  throw new Error('web directory is missing.');
}

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

copyDirectory(webDir, distDir);
mkdirSync(join(distDir, 'assets'), { recursive: true });

for (const iconFile of iconFiles) {
  copyFileSync(join(extensionDir, 'images', iconFile), join(distDir, 'assets', iconFile));
}

const indexPath = join(distDir, 'index.html');
const indexHtml = readFileSync(indexPath, 'utf8')
  .replaceAll('{{EXTENSION_VERSION}}', manifest.version)
  .replaceAll('{{CHROME_WEB_STORE_URL}}', chromeWebStoreUrl);

writeFileSync(indexPath, indexHtml);

const privacyPath = join(distDir, 'privacy-policy.html');
const privacyHtml = readFileSync(privacyPath, 'utf8')
  .replaceAll('{{CHROME_WEB_STORE_URL}}', chromeWebStoreUrl);

writeFileSync(privacyPath, privacyHtml);

console.log(`Built site in ${distDir}`);
console.log(`Install link points to ${chromeWebStoreUrl}`);
