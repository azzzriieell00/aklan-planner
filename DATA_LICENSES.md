# Data and attribution

The application code and original synthetic demo geometries use the MIT license. Third-party data and imagery have separate terms.

## Bundled administrative boundaries

Credit **geoBoundaries; NAMRIA, Philippine Statistics Authority (PSA), and OCHA Philippines; 2020 reference** when sharing maps or extracted boundaries. The source metadata records **[CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/)**. Keep this attribution and source links with redistributed files. See the [geoBoundaries gbOpen release documentation](https://www.geoboundaries.org/api.html) for its release attribution guidance.

| Layer | Source metadata | Pinned build |
| --- | --- | --- |
| Aklan province | [Philippines ADM2](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM2/) | PHL-ADM2-2640588 · 2023-07-05 |
| 17 municipalities | [Philippines ADM3](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/) | PHL-ADM3-30758251 · 2023-12-12 |

The upstream geometry was already simplified. This repository extracts Aklan, selects and sorts its 17 municipalities, and adds provenance fields. No additional geometry simplification was applied. Island components are retained. Full source URLs, transformations, reference year, and SHA-256 checksums are in [public/data/provenance.json](public/data/provenance.json).

These are administrative display boundaries, not a surveyed parcel dataset. The reference year is 2020, not the acquisition year. A simplified coastal edge can differ from more detailed/current mapping.

## Esri World Imagery

Imagery is fetched online from [World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9). It is not bundled, downloaded for offline use, or offered under MIT. Keep the provider attribution visible. Esri Leaflet's [TiledMapLayer](https://esri.github.io/esri-leaflet/api-reference/layers/tiled-map-layer.html) adds service credits to the map. Esri's [citation guidance](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040) also applies to shared screenshots.

Credits returned by the service at verification: **Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community**. Credits and imagery can change. Dates, positional accuracy, and resolution vary by location. View the service's current item terms and configure suitable ArcGIS access for your deployment; this project makes no promise of unlimited or unrestricted basemap use.

README screenshots retain map attribution and depict synthetic demo lots. They illustrate this application's interface, not certified lot divisions.

## Your records and other sources

Drawing from imagery creates a draft boundary. It does not establish ownership or legal zoning. Imported source records retain the permissions and obligations of their providers. Record sources, dates, verification status, and limitations; avoid publishing personal/property evidence without permission.

OpenStreetMap (ODbL), ESA WorldCover (CC BY 4.0), and official hazard portals are potential future sources, not bundled layers. Their licenses and dates need to travel with any later import. Never relabel land cover as approved zoning or absence of mapped hazard as safety.

The optional online Google Fonts families DM Sans and Manrope use the SIL Open Font License. System fonts remain available if they cannot load. Runtime packages retain their respective licenses in their distributions.
