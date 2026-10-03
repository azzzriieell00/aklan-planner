# Contributing to Aklan Planner

Contributions should improve the Aklan map, parcel drawing, GIS validation, review workflow, or documentation. Keep each pull request focused on one problem and explain the behavior a user will notice.

## Set up and check a change

Use Node.js 24 LTS; the supported minimum is 22.12. Open the repository in VS Code and run:

```sh
npm ci
npm run dev
```

The app opens at `http://127.0.0.1:5173/`. Imagery needs internet access. Before submitting a code or data change, run the same checks as CI:

```sh
npm test
npm run data:verify
npm run build
```

For geometry, import, storage, or review changes, add a regression test that covers the failure or new behavior. For map controls and layout, exercise the affected browser workflow and check a narrow mobile viewport. Describe the checks you ran; explain any check you could not run. Documentation-only changes need a review of links, commands, and claims.

## Reproduce bugs safely

Include the steps, expected result, actual result, browser, and a screenshot or console error when useful. Use the bundled synthetic demo or a small invented polygon to reproduce a problem.

**Demo** and **My GIS** records are separated in the map and analysis, but both belong to the browser's stored workspace. Use a separate browser profile or an isolated origin such as `http://localhost:5173/` for testing. Storage differs by host and port. Export a backup before restoring a workspace: restore replaces current records and reviews.

Do not attach private parcel data, ownership details, personal evidence, workspace backups, or credentials to an issue or pull request. Check screenshots and staged files as well. Keep local private files under ignored `private-data/` or `backups/`; `.gitignore` cannot protect files already tracked. The examples under `docs/` are deliberately synthetic.

## Contribute GIS data with provenance

Read [the GIS data guide](docs/GIS_DATA_GUIDE.md) and [data licenses](DATA_LICENSES.md) before proposing a dataset. Include its source URL, license and redistribution permission, reference date, attribution, coordinate system, and extraction or transformation steps. Preserve record source, source date, and verification labels. Imported geometry must be WGS84 GeoJSON Polygon or MultiPolygon within Aklan.

Label invented samples as synthetic and imagery-traced boundaries as drafts. Do not describe land cover as approved zoning or missing hazard overlap as proof of safety. Keep imagery/provider credits visible.

The bundled administrative files have pinned sources and checksums in `public/data/provenance.json`. A source update needs a reviewed provenance change, reproducible acquisition steps, and matching verification checks. Do not replace a checksum merely to make a failing check pass. `npm run data:acquire` reproduces the currently reviewed extraction; it is not a general downloader.

## Submit a focused pull request

Describe the problem, the resulting behavior, and validation evidence. Link a related issue when one exists. Avoid unrelated formatting or dependency changes. Update the relevant documentation when the workflow or data meaning changes, and use the pull request template to make review straightforward.
