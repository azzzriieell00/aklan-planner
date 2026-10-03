# Preparing Aklan GIS records

Use this version without contacting an LGU: create original drafts, collect your own observations, or import public data whose license permits the intended use. Keep private evidence outside a public GitHub repository.

## Draw an irregular boundary

Select a municipality and zoom to the site. Choose **Parcel**, click every corner in order around its perimeter, and check the corner counter. Continue beyond three corners. Click **Undo last point** if needed, then **Finish boundary** when complete. The tool also supports closing at the first corner. **Cancel drawing** or **Escape** discards the unsaved geometry. The editor's Cancel button discards the pending record.

Name the record, record its source and source date, and keep **Draft / unverified** for imagery sketches. Add method and accuracy notes. **Field observed** describes your collection method; **Source record attached / referenced** describes evidence availability. Neither label is an automatic certification. Save the record, click its outline to inspect it, and use **Edit boundary on map** to adjust it. Save boundary commits changes; Cancel editing or Escape restores the stored shape.

## Prepare a GeoJSON import

In QGIS, fix invalid geometry and export polygons as RFC 7946 GeoJSON in WGS84 / EPSG:4326, longitude then latitude. A projected shapefile cannot be converted by renaming its extension. The app accepts Polygon and MultiPolygon features, including valid holes; it does not import points, roads as lines, rasters, or shapefile ZIPs.

The whole polygon must fall inside the bundled Aklan boundary, allowing a small numerical tolerance (larger of 1 m² or 0.001% of polygon area). The source boundary is simplified, so coastal discrepancies require reviewing the geometry/source instead of treating rejection as a legal boundary decision.

An example feature:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[122.367,11.699],[122.368,11.699],[122.368,11.700],[122.367,11.700],[122.367,11.699]]]
  },
  "properties": {
    "kind": "parcel",
    "name": "Example draft parcel",
    "municipality": "Kalibo",
    "barangay": "",
    "reference": "DRAFT-001",
    "category": "Unknown",
    "source": "Original imagery sketch; not surveyed",
    "sourceDate": "2026-10-03",
    "verification": "draft",
    "notes": "Invented example; replace with your own verified geometry.",
    "demo": true
  }
}
```

Supported `kind` values: `parcel`, `zone`, `hazard`, `observation`. Select a default type in the import dialog for files without a `kind` field. Missing source/verification fields become imported drafts. All features are validated before any are committed; an invalid feature rejects the file. Import assigns new record IDs so it cannot overwrite an existing record. Extra properties are not retained: map needed source fields to the listed schema before importing. Municipality labels must match one of the 17 names in the app; they are descriptive labels, not a spatial certification.

Create proposed zoning as `zone` records. Record an adopted ordinance only if you actually have a source and understand its permissions; the application's draft classes do not become approved zoning by changing a category. Add hazard polygons only with their source date, class definitions, and coverage limits. Do not generate a hazard designation by visually guessing from the satellite basemap.

## Open-data starting points

| Source | Useful data | Status here |
| --- | --- | --- |
| [geoBoundaries](https://www.geoboundaries.org/api.html) | Aklan province and municipality context | Bundled, 2020 reference, separate attribution |
| [OpenStreetMap / Geofabrik](https://download.geofabrik.de/asia/philippines.html) | Community roads, buildings, waterways, facilities | Not acquired; ODbL requirements apply |
| [ESA WorldCover](https://esa-worldcover.org/en/data-access) | Dated land-cover classes | Not acquired; land cover is not zoning |
| [HazardHunterPH](https://hazardhunter.georisk.gov.ph/) | Hazard information and source leads | Not bundled; verify coverage and redistribution terms |

Never infer cadastral lot divisions from an OSM building footprint or a land-cover pixel. You can build useful planning drafts first and add better licensed/source-verified layers later.

## Analysis and evidence

Area is Turf's spherical area on WGS84 geometry. Each percentage is intersection area divided by parcel area. Available zoning coverage merges intersections first to avoid double counting overlapping zones. All zones/hazards in the parcel's demonstration or user workspace are considered, even when a map checkbox hides them. Overlapping draft zones are flagged. Missing coverage remains unknown.

A saved review stores a copy of the parcel and relevant overlays. Export a workspace backup to retain these snapshots. GeoJSON export contains current records, not review history. Reports escape record/reviewer text and contain methods and limitations; use the report's Print / save PDF button for a PDF copy.
