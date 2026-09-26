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
5. Open an assignment rubric editor or a Workshop assessment form configured with the Rubric grading strategy on any HTTPS Moodle.
6. Click the extension icon. The importer appears on that page.

## Activation and permissions

The extension asks for no site access when it is installed. Its only
permissions are `storage`, `scripting`, and `activeTab`.

- **One click, any Moodle.** On a rubric editing page or a Workshop assessment
  form, clicking the extension icon grants `activeTab` for that tab and injects
  the importer. Chrome shows no permission prompt for this, and the access ends
  when the tab navigates away.
- **Always on one site.** The icon menu offers "Always activate on this site".
  It requests access to that origin only (`optional_host_permissions`) and
  registers the importer for that site's rubric and Workshop pages, so it
  appears without clicking. The options page lists these sites, grants a
  missing permission again, or removes a site together with its permission.

Nothing runs on other websites or on other pages of a Moodle site.
`npm run validate` fails if the manifest declares `host_permissions` or static
`content_scripts`.

Until version 1.1.0 the importer ran automatically on the Xunta Moodle hosts
(`edu.xunta.gal` and its subdomains). People who update from those versions see
a one-time page explaining the new activation; sites they had added in the
options keep working.

## CSV Format

Each criterion uses two rows. Column A contains the criterion description. Columns B onward contain level definitions, and the cells directly below them contain the corresponding grades.

Workshop grades must be unique integers between 0 and 100 within each criterion. Moodle initially exposes a limited number of Workshop level fields. If an import needs more levels, MoodlIA asks for confirmation before using Moodle's "Save and continue editing" action to create the additional fields, then resumes the import automatically. The final imported form remains open for review.

## Localization

The extension UI supports English, Spanish, French, German, Portuguese, Galician, Catalan, and Basque.

Spanish is the default locale. Chrome-supported manifest locales are stored in `extension/_locales`. Portuguese is available as generic `pt` plus dedicated `pt_PT` and `pt_BR` variants. Galician (`gl`) and Basque (`eu`) are also included there for compatibility, and the importer, the icon menu, the options page, and the what's-new page load those translations directly at runtime, because `chrome.i18n` does not offer them.

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

## License

Copyright (C) 2026 Pablo Gallego.

This project is free software released under the GNU General Public License version 3 or later. See `LICENSE`.
