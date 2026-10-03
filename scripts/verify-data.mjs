import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { area, bbox } from '@turf/turf';
const directory=new URL('../public/data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('provenance.json',directory),'utf8'));
const expected=['Altavas','Balete','Banga','Batan','Buruanga','Ibajay','Kalibo','Lezo','Libacao','Madalag','Makato','Malay','Malinao','Nabas','New Washington','Numancia','Tangalan'];
for(const dataset of manifest.datasets){
  const bytes=await readFile(new URL(dataset.file,directory));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),dataset.sha256,`${dataset.file}: checksum changed; review the source and manifest`);
  const collection=JSON.parse(bytes);
  assert.equal(collection.type,'FeatureCollection');assert.equal(collection.features.length,dataset.featureCount);
  if(dataset.level==='ADM2')assert.equal(collection.features[0].properties.shapeName,'Aklan');
  else assert.deepEqual(collection.features.map(f=>f.properties.shapeName).sort(),expected.sort());
  assert.equal(new Set(collection.features.map(f=>f.properties.shapeID)).size,dataset.featureCount);
  for(const feature of collection.features){
    assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));
    assert.ok(Number.isFinite(area(feature))&&area(feature)>0);
    assert.equal(feature.properties.reference_year,2020);
    const [west,south,east,north]=bbox(feature);assert.ok(west>121.7&&east<122.7&&south>11.2&&north<12.1,'Unexpected extent');
  }
  console.log(`${dataset.file}: checksum, ${dataset.featureCount} features, names, IDs, geometry, and Aklan extent verified`);
}
