# Troubleshooting Aklan Planner

Use the [GIS data guide](GIS_DATA_GUIDE.md) for the normal drawing and import workflow. The steps below help when drawing, finding records, or saving to the browser does not work as expected.

## A boundary will not finish or save

| What you see | What to do |
| --- | --- |
| **Parcel** is disabled | Wait for the bundled Aklan boundaries to load. If an **Aklan boundaries could not be loaded** error appears, check the connection or local server and reload after exporting any current work. |
| **Finish boundary** is disabled | Add at least three corners. Continue clicking around the perimeter for an irregular parcel; three is a minimum, not a maximum. |
| **Polygon edges cannot cross.** | Use **Undo last point**, then place the corner in perimeter order so edges do not cross. Check the closing edge before finishing. |
| The polygon is rejected as outside Aklan | Adjust the shape to the available boundary. The bundled boundary is simplified, so a coastal discrepancy needs source review; rejection does not establish a legal boundary. |
| The polygon has less than 1 square metre of area | Zoom in and redraw a meaningful area. Three points on one straight line do not enclose a parcel. |
| The record editor stays open | Check the error and required **Record name**, **Municipality**, and **Source** fields, then choose **Save record** again. |

**Finish boundary** opens the record editor; it does not save the record. Keep **Draft / unverified** for an imagery sketch, record its actual source/date and method in **Notes**, then choose **Save record**. A category or verification label does not certify ownership, a surveyed boundary, or approved zoning.

Before finishing, **Cancel drawing** or **Escape** discards the unsaved shape. The editor's **Cancel** discards the pending record. To adjust a saved record, inspect it and choose **Edit boundary on map**, drag its handles, then **Save boundary**. **Cancel editing** or **Escape** leaves its saved boundary unchanged.

## A saved parcel is missing from the map or list

1. Choose **My GIS** for your own records, or **Demo** for synthetic examples.
2. Open **Layers & records**, set **Municipality** to **All Aklan municipalities**, and clear the search field.
3. Choose the **Parcels** record tab and enable the **Parcels** map layer.
4. Select the record in the list to zoom to it. Its popup's **Inspect / review this record** button opens the inspection tools.

If the entire workspace appears empty after changing URLs, return to the browser and address where you saved it. The live site, `localhost`, `127.0.0.1`, and different ports have separate browser storage. Export a workspace backup at the original address and restore it at the new address. Clearing site data removes local records.

## The app reports a saving or loading error

**Browser storage is full or unavailable.** Changes are still in memory. Immediately choose **Export backup** in the error message, **Backup** in the header, or **Workspace tools → Export workspace backup**. Keep the downloaded JSON before reloading, closing the tab, or clearing site data. The **GIS record saved.** message confirms the record was added to the current workspace; **Saved on this device** confirms a successful browser-storage write.

**Automatic save is paused to preserve the stored copy.** If **Download stored copy** is available, download it first. This preserves the original data that failed to load; **Export backup** downloads the current in-memory workspace, which may be empty or contain new work. Keep both files if you have made changes. Open **Workspace tools → Restore a workspace backup**, choose a valid Aklan Planner backup, check the record/review counts, then choose **Replace workspace** to resume saving. Restoring replaces current records and reviews, so export them first. The recovery file may need repair before it can be restored.

The workspace supports up to 500 records and 500 reviews, but browser storage can fill before those limits. A backup restore accepts an Aklan Planner version 1 JSON file up to 30 MB. GeoJSON is a separate format: use **Import** for polygon records rather than the workspace restore dialog.

## A review or export does not contain what you expected

To save an assessment, select a parcel, choose **Inspect / review this record**, enter **Your name** and **Assessment**, select the **Review state**, then choose **Save review**. Open **Workspace tools → Saved parcel reviews → Report** for the saved HTML report and its **Print / save PDF** button. This path works on phones and in both Map view and Workbench; desktop users can also use **Reviews** in the header.

**Backup** includes all workspace records and saved review snapshots. **Export GeoJSON** below the map includes current records in the active **My GIS** or **Demo** workspace; it does not include review history. Later record edits do not update an existing saved review. Save a new review after changes to retain the revised evidence.

Hiding **Draft zones** or **Hazard overlays** changes map visibility, not the parcel analysis. Missing overlap means no overlap in the available records, not proof of safety or an approved zoning classification.
