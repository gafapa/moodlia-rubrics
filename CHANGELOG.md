# Changelog

## Unreleased

- Import assignment and Workshop rubrics from Excel `.xlsx` workbooks, using the
  first worksheet and the same two-row-per-criterion layout as CSV files.
- Keep CSV support and update the file picker, translations, website, and
  documentation for both formats.
- Click Moodle's actual add-level button during assignment rubric import and
  wait for each new level before filling it.

## 1.2.0 - 2026-09-26

Activation changes. People who update from an earlier version see a one-time
page that explains them.

- Works on any Moodle: on a rubric editing page or a Workshop assessment form,
  click the extension icon and the importer appears on that page. This uses
  `activeTab`, so the extension asks for no site access when it is installed.
- The icon menu offers "Always activate on this site", which requests access to
  that site only and then shows the importer there without clicking. This
  replaces typing the site address in the options page, which remains available.
- The importer no longer runs automatically on the Xunta Moodle hosts
  (`edu.xunta.gal` and its subdomains). Use the icon or "Always activate on this
  site" there as on any other Moodle. Sites added in the options before this
  version keep working.
- The options page marks sites whose permission was removed and can grant it
  again.
- The icon menu, the options page, and the what's-new page are translated into
  Galician and Basque too.

## 1.1.0 - 2026-09-02

- Imports rubrics into Workshop assessment forms that use the Rubric grading
  strategy, including adding the Workshop level fields an import needs.

## 1.0.21 - 2026-05-13

- Last release before this changelog; published on the Chrome Web Store.
