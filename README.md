# MoodlIA Rubrics

MoodlIA Rubrics is a browser extension for importing Moodle rubrics from CSV files.

## Project Structure

- `extension/`: Manifest V3 extension source loaded by the browser.
- `extension/scripts/content.js`: Moodle rubric importer content script.
- `extension/scripts/workbook.js`: Native CSV parser with no third-party runtime dependency.
- `extension/styles/`: Content script styles.
- `web/`: Static landing page source.
- `scripts/`: Local project validation and packaging scripts.

## Development

Run validation from the project root:

```bash
npm run validate
```

Load the extension in Chrome or another Chromium-based browser:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `extension` folder.
5. Open a Moodle rubric editing page on a built-in HTTPS host, or open the extension options page to add another Moodle host.
6. Grant the requested host permission if you add a custom Moodle site.

The extension does not inject itself into every website. It runs by default on the supported Xunta Moodle hosts over HTTPS and registers additional content scripts only for HTTPS Moodle hosts explicitly added by the user from the options page.

Built-in Moodle hosts:

- `www.edu.xunta.gal`
- `edu.xunta.gal`
- `centros.edu.xunta.gal`
- `platega.edu.xunta.gal`
- `eva.edu.xunta.gal`

## Localization

The extension UI supports English, Spanish, French, German, Portuguese, Galician, Catalan, and Basque.

Spanish is the default locale. Chrome-supported manifest locales are stored in `extension/_locales`. Portuguese is available as generic `pt` plus dedicated `pt_PT` and `pt_BR` variants. Galician (`gl`) and Basque (`eu`) are also included there for compatibility, and the content script loads those translations directly at runtime so the in-page importer UI can use them even when the browser store does not expose them as listing locales.

## Packaging

Build the landing page and create a distributable ZIP file:

```bash
npm run build
```

The generated website and ZIP file are written to `dist/`.

## Runtime Footprint

The extension does not ship with third-party runtime libraries. Spreadsheet import is handled by browser-native code for `.csv` files to keep the unpacked extension as small as possible.

## Quality Checks

```bash
npm run check
```

The suite validates the extension package, CSV parsing, Moodle host normalization, optional permissions, and stored-site deduplication.
