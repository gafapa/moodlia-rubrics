# MoodlIA Rubrics

MoodlIA Rubrics is a browser extension for importing Moodle rubrics from CSV files into assignments and Workshops.

## Project Structure

- `extension/`: Manifest V3 extension source loaded by the browser.
- `extension/scripts/content.js`: Moodle rubric importer content script.
- `extension/scripts/workbook.js`: Native CSV parser with no third-party runtime dependency.
- `extension/scripts/rubric-model.js`: Shared CSV-to-rubric mapping and Workshop validation.
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
5. Open an assignment rubric editor or a Workshop assessment form configured with the Rubric grading strategy on a built-in HTTPS host. Alternatively, open the extension options page to add another Moodle host.
6. Grant the requested host permission if you add a custom Moodle site.

The extension does not inject itself into every website. It runs by default on the supported Xunta Moodle hosts over HTTPS and registers additional content scripts only for HTTPS Moodle hosts explicitly added by the user from the options page.

## CSV Format

Each criterion uses two rows. Column A contains the criterion description. Columns B onward contain level definitions, and the cells directly below them contain the corresponding grades.

Workshop grades must be unique integers between 0 and 100 within each criterion. Moodle initially exposes a limited number of Workshop level fields. If an import needs more levels, MoodlIA asks for confirmation before using Moodle's "Save and continue editing" action to create the additional fields, then resumes the import automatically. The final imported form remains open for review.

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

The suite validates the extension package, CSV parsing, rubric mapping, Workshop grade constraints, Moodle host normalization, optional permissions, and stored-site deduplication.
