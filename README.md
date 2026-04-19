# EL CSV2Excel Converter

Simple client-side CSV filtering and Excel export tool.

## Project structure

- `index.html` — main page layout.
- `assets/css/styles.css` — UI styling.
- `assets/js/config.js` — editable settings (governorates, smart zones, export columns, pagination).
- `assets/js/app.js` — application logic (parsing, filtering, preview, export).

## Adjust settings

Edit `assets/js/config.js`:

- `govMap` to add/update governorate codes.
- `smartZones` and `smartButtons` for FTK smart filtering groups.
- `alwaysDeleteColumns` and `pendingOnlyDeleteColumns` for export column rules.
- `rowsPerPage` and `defaultSheetName` for preview/export defaults.

No build step is required; open `index.html` in a browser.
