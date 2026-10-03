import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { bbox } from '@turf/turf';
const directory=new URL('../public/data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('provenance.json',directory),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const sources=[];
for(const dataset of manifest.datasets){
  const response=await fetch(dataset.downloadUrl,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Download failed: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),dataset.sourceSha256,'Pinned upstream source changed');
  sources.push(JSON.parse(bytes));
}
const province=sources[0].features.find(f=>f.properties.shapeName==='Aklan');assert.ok(province,'Aklan missing');
const names=['Altavas','Balete','Banga','Batan','Buruanga','Ibajay','Kalibo','Lezo','Libacao','Madalag','Makato','Malay','Malinao','Nabas','New Washington','Numancia','Tangalan'];
const bounds=bbox(province);
const units=sources[1].features.filter(f=>{const b=bbox(f);return names.includes(f.properties.shapeName)&&b[0]>=bounds[0]-.03&&b[2]<=bounds[2]+.03&&b[1]>=bounds[1]-.03&&b[3]<=bounds[3]+.03;});
assert.equal(units.length,17);assert.equal(new Set(units.map(f=>f.properties.shapeName)).size,17);
const properties=f=>({...f.properties,source:'geoBoundaries; NAMRIA / PSA / OCHA Philippines',reference_year:2020,license:'CC BY 3.0 IGO (original source); geoBoundaries attribution required',boundary_use:'Administrative context; simplified geometry'});
const extracted=[[province],units.sort((a,b)=>a.properties.shapeName.localeCompare(b.properties.shapeName))].map(features=>JSON.stringify({type:'FeatureCollection',features:features.map(f=>({...f,properties:properties(f)}))}));
// Check both outputs before writing either file.
for(let i=0;i<extracted.length;i++)assert.equal(hash(extracted[i]),manifest.datasets[i].sha256,'Extraction differs from the reviewed bundled data');
for(let i=0;i<extracted.length;i++)await writeFile(new URL(manifest.datasets[i].file,directory),extracted[i]);
console.log('Reproduced both Aklan datasets from pinned sources. Run npm run data:verify.');
