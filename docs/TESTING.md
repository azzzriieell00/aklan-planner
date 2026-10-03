# Verification notes

Verified locally on 3 October 2026 with Node 24.19.0 and the installed lockfile.

- `npm test`: 18 tests passed. Cases include split-zone percentages, union coverage, conflicting zones, touching edges, missing hazard coverage, demo/user isolation, holes/MultiPolygons, Aklan containment, malformed/self-crossing geometry, duplicate IDs, atomic imports, legacy CRS rejection, review snapshot independence, rebuilding imported calculations, preserving source dates, and escaping report text.
- `npm run data:verify`: both bundled file checksums, Aklan identity, all 17 municipality names, unique source IDs, polygon types/positive area, reference years, and approximate Aklan extent passed.
- `npm run data:acquire`: reproduced both extracted files from the pinned national datasets, matching source and output checksums.
- `npm run build`: TypeScript and production Vite build passed. Vite reports a non-failing bundle-size advisory (about 630 kB minified JavaScript / 185 kB gzip); imagery is fetched separately online.
- Dependency installation/audit: zero known vulnerabilities reported at verification time. This is a dated registry check, not a security guarantee.

## Browser verification

Tests ran on an isolated `http://localhost:5173/` origin, separate from the user's `127.0.0.1` records.

1. Reproduced and corrected map tile overflow: React was replacing Leaflet's dynamically added container classes when drawing started. The container class is now constant, with map clipping and contained stacking order.
2. Reproduced the third-corner failure: Leaflet.draw 1.0.4's live-area formatting assigns an undeclared variable in strict mode. The faulty tooltip is disabled; saved area is calculated through Turf. Six corners were added, Undo reduced the shape to five, Finish opened the record editor, and saving produced a five-corner parcel with calculated area.
3. Cancel drawing after placing points and Escape both removed the unsaved shape. Cancel editing removed editing handles and retained the saved geometry/area.
4. An out-of-Aklan GeoJSON was rejected with commit disabled. A valid single synthetic feature previewed and imported without replacing existing records.
5. Demo parcel 01 showed approximately 50/50 zone allocation, 100% available union coverage, and a 16.7% synthetic flood overlap. A review saved and its downloadable HTML report was created.
6. Backup downloaded as valid version-1 JSON containing 19 QA records and one review. The included 17-record demo backup restored, and records/review remained after reload.
7. Reference-style map view, yellow lot outlines, right-hand layers/record panel, record popup and close control verified. Workbench and inspection controls remain available.
8. A 390 × 844 viewport had no document-width overflow. Cancel/Finish/Undo fit within the map, the parcel popup was contained with a close button, and the layers panel opened/closed. The viewport override was reset after testing.
9. Feature-detected browser tools listed existing records and selected a valid record; a missing ID was rejected without changing data.
10. Polygon rendering uses SVG to avoid a pending Canvas redraw accessing a removed context during development hot reload.

## GitHub and live-site verification

Published on 3 October 2026 at [azzzriieell00/aklan-planner](https://github.com/azzzriieell00/aklan-planner). All 35 uploaded source files matched the original Git blob hashes; no files were missing or added. [CI](https://github.com/azzzriieell00/aklan-planner/actions/runs/37114636620) and [GitHub Pages deployment](https://github.com/azzzriieell00/aklan-planner/actions/runs/37114732314) succeeded, including all 18 tests, data verification, and the production build.

The [live app](https://azzzriieell00.github.io/aklan-planner/) loaded the bundled Aklan boundaries and Esri World Imagery. Demo mode showed 14 parcels and 17 total sample records. Selecting an irregular parcel opened its details, area estimate, source label, and close control. These checks confirm the published app loads; the more detailed browser checks above were performed locally.

## Remaining limits

Authenticated imagery using a user-supplied key has not been tested. Browser storage capacity varies; representative small records were tested, not every possible 500-record / complex-geometry workload. Official zoning, cadastral and hazard accuracy cannot be tested because those datasets are not bundled. Repeat the automated checks and the relevant browser workflow when modifying the app.
