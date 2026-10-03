import { area, booleanPointInPolygon, difference, featureCollection, intersect, kinks, point, union } from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';
import type { Analysis, GISRecord, GeometryFeature, Kind, Overlap, PolygonGeometry, RecordProperties } from './types';

export const MUNICIPALITIES = ['Altavas', 'Balete', 'Banga', 'Batan', 'Buruanga', 'Ibajay', 'Kalibo', 'Lezo', 'Libacao', 'Madalag', 'Makato', 'Malay', 'Malinao', 'Nabas', 'New Washington', 'Numancia', 'Tangalan'];
export const CATEGORIES: Record<Kind, string[]> = {
  parcel: ['Unknown', 'Residential', 'Commercial', 'Agricultural', 'Industrial', 'Institutional', 'Tourism', 'Conservation', 'Mixed use'],
  zone: ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Institutional', 'Tourism', 'Conservation', 'Mixed use'],
  hazard: ['Flood', 'Landslide', 'Storm surge', 'Other'],
  observation: ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Institutional', 'Tourism', 'Conservation', 'Mixed use', 'Other'],
};
export const COLORS: Record<string, string> = {Residential: '#e6b832', Commercial: '#e97568', Agricultural: '#50a76f', Industrial: '#af84de', Institutional: '#75a8ee', Tourism: '#5ac5cd', Conservation: '#478854', 'Mixed use': '#be89ad', Flood: '#8668d8', Landslide: '#c99251', 'Storm surge': '#599bdc'};
const kindSet = new Set<Kind>(['parcel', 'zone', 'hazard', 'observation']);
const string = (value: unknown, maximum = 500) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
export const uid = () => crypto.randomUUID();
export const emptyWorkspace = () => ({ version: 1 as const, records: [], reviews: [] });

export function validateGeometry(input: unknown): PolygonGeometry {
  if (!input || typeof input !== 'object') throw Error('Each record needs a polygon geometry.');
  const g = input as PolygonGeometry;
  if (!['Polygon', 'MultiPolygon'].includes(g.type) || !Array.isArray(g.coordinates)) throw Error('Use Polygon or MultiPolygon geometry. Points and lines are not supported in this version.');
  if (!g.coordinates.length) throw Error('Empty geometry is not supported.');
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let vertices = 0;
  if (!polygons.length) throw Error('Empty geometry is not supported.');
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) throw Error('A polygon needs an outer ring.');
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw Error('Close each polygon ring with at least four coordinates.');
      for (const coordinate of ring) {
        vertices++;
        if (vertices > 50000) throw Error('A record is too detailed. Simplify it to at most 50,000 vertices.');
        if (!Array.isArray(coordinate) || coordinate.length < 2 || !coordinate.every(v => typeof v === 'number' && Number.isFinite(v)) || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) throw Error('Coordinates must be finite WGS84 longitude, latitude values.');
      }
      const first = ring[0], last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) throw Error('Polygon rings must be closed.');
      const polygonFeature: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
      if (kinks(polygonFeature).features.length) throw Error('Polygon rings must not cross themselves.');
    }
    const shell: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [polygon[0]]} };
    for (let index = 1; index < polygon.length; index++) {
      if (!polygon[index].every(p => booleanPointInPolygon(point(p), shell, {ignoreBoundary: true}))) throw Error('A hole must lie strictly within its outer polygon.');
      const hole: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: {type:'Polygon', coordinates:[polygon[index]]} };
      if (area(intersect(featureCollection([shell, hole]))!) + .01 < area(hole)) throw Error('A hole crosses its outer polygon.');
      for (let previous = 1; previous < index; previous++) {
        const earlier: Feature<Polygon> = {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[polygon[previous]]}};
        const shared=intersect(featureCollection([earlier,hole]));
        if(shared && area(shared)>.01) throw Error('Polygon holes must not overlap.');
      }
    }
  }
  const feature: GeometryFeature = { type: 'Feature', geometry: g, properties: {} };
  if (area(feature) < 1) throw Error('A polygon must have at least 1 square metre of area.');
  if (polygons.length > 1) {
    const parts = polygons.map(coordinates => ({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates}} as Feature<Polygon>));
    for(let i=0;i<parts.length;i++) for(let j=0;j<i;j++) { const shared=intersect(featureCollection([parts[i],parts[j]])); if(shared && area(shared)>.01) throw Error('MultiPolygon parts must not overlap.'); }
  }
  return structuredClone(g);
}

export function assertInAklan(geometry: PolygonGeometry, boundary: GeometryFeature) {
  const feature: GeometryFeature = {type:'Feature',geometry,properties:{}};
  const outside = difference(featureCollection([feature,boundary]));
  if (outside && area(outside) > Math.max(1, area(feature) * .00001)) throw Error('This polygon extends outside the available Aklan boundary. Adjust it before saving. The boundary is simplified; coastal discrepancies may need review.');
}

export function normalizeRecord(input: unknown, fallbackKind: Kind, boundary: GeometryFeature, preserveId = false): GISRecord {
  if (!input || typeof input !== 'object') throw Error('Invalid GeoJSON feature.');
  const f=input as GISRecord;
  if(f.type !== 'Feature') throw Error('GeoJSON must contain Features.');
  const geometry=validateGeometry(f.geometry);
  assertInAklan(geometry,boundary);
  const p=f.properties || {} as RecordProperties;
  const kind=kindSet.has(p.kind) ? p.kind : fallbackKind;
  const municipality=string(p.municipality,80);
  if(municipality && !MUNICIPALITIES.includes(municipality)) throw Error(`Unknown Aklan municipality: ${municipality}.`);
  const now=new Date().toISOString();
  const properties: RecordProperties = {
    id: preserveId && string(p.id,100) ? string(p.id,100) : uid(), kind,
    name: string(p.name,100) || `${kind[0].toUpperCase()+kind.slice(1)} ${now.slice(0,10)}`,
    municipality, barangay:string(p.barangay,100), reference:string(p.reference,100),
    category:string(p.category,80) || CATEGORIES[kind][0], source:string(p.source,200) || 'User-created or imported draft',
    sourceDate: /^\d{4}-\d{2}-\d{2}$/.test(string(p.sourceDate,10)) ? p.sourceDate : '',
    verification: ['draft','field_observed','source_record'].includes(p.verification) ? p.verification : 'draft',
    notes:string(p.notes,4000), demo:p.demo === true,
    createdAt:preserveId && string(p.createdAt,40) ? string(p.createdAt,40) : now, updatedAt:preserveId && string(p.updatedAt,40) ? string(p.updatedAt,40) : now,
  };
  return {type:'Feature',geometry,properties};
}

export function parseGeoJSON(text: string, kind: Kind, boundary: GeometryFeature): GISRecord[] {
  const json=JSON.parse(text);
  if (json.crs) throw Error('Import WGS84 GeoJSON without a legacy CRS declaration. Reproject the source in QGIS first.');
  const list=json.type==='FeatureCollection'?json.features:json.type==='Feature'?[json]:null;
  if(!Array.isArray(list)||!list.length) throw Error('Choose a GeoJSON Feature or a non-empty FeatureCollection.');
  if(list.length>500) throw Error('Import at most 500 records in one file.');
  return list.map((f,index)=>{try{return normalizeRecord(f,kind,boundary)}catch(error){throw Error(`Feature ${index+1}: ${(error as Error).message}`)}});
}

function mergedArea(features: GeometryFeature[]) {
  if(!features.length) return 0;
  if(features.length===1) return area(features[0]);
  const merged=union(featureCollection(features));
  return merged ? area(merged) : 0;
}

export function analyzeParcel(parcel: GISRecord, records: GISRecord[]): Analysis {
  const total=area(parcel);
  if(!Number.isFinite(total)||total<=0) throw Error('Parcel area must be positive.');
  // Demonstration and user workspaces never contribute to one another's results.
  const candidates=records.filter(r=>r.properties.demo===parcel.properties.demo);
  const zones:Overlap[]=[], hazards:Overlap[]=[], pieces:GeometryFeature[]=[];
  const warnings:string[]=[];
  for(const record of candidates) {
    if(!['zone','hazard'].includes(record.properties.kind))continue;
    const clipped=intersect(featureCollection([parcel,record]));
    if(!clipped || area(clipped)<=.01)continue;
    const overlap:Overlap={name:record.properties.name,category:record.properties.category,percent:Math.min(100,100*area(clipped)/total),area:area(clipped),source:record.properties.source,demo:record.properties.demo};
    if(record.properties.kind==='zone') { zones.push(overlap);pieces.push(clipped); } else hazards.push(overlap);
  }
  const zoneCoverage=Math.min(100,100*mergedArea(pieces)/total);
  const sum=pieces.reduce((a,p)=>a+area(p),0);
  const conflictingZones=sum-mergedArea(pieces)>Math.max(1,total*.0001);
  if(conflictingZones)warnings.push('Draft zone polygons overlap each other. Their percentages must not be added as separate land allocations.');
  if(zoneCoverage<99.99)warnings.push(`${(100-zoneCoverage).toFixed(1)}% of this parcel has no available zone polygon.`);
  warnings.push('Hazard coverage is not certified complete. No overlap means no mapped overlap, not proof of safety.');
  if(parcel.properties.verification==='draft')warnings.push('This parcel geometry is a draft, not a certified cadastral boundary.');
  const finding=parcel.properties.demo?'Demonstration only':zones.length?'Draft overlays require review':'Insufficient zoning data';
  return {area:total,zones:zones.sort((a,b)=>b.percent-a.percent),hazards:hazards.sort((a,b)=>b.percent-a.percent),zoneCoverage,conflictingZones,finding,warnings};
}

export function coordinates(geometry: PolygonGeometry): Position[] {return geometry.type==='Polygon'?geometry.coordinates.flat():geometry.coordinates.flat(2);}
export function formatArea(squareMetres:number) {return squareMetres>=10000 ? `${(squareMetres/10000).toLocaleString(undefined,{maximumFractionDigits:2})} ha` : `${squareMetres.toLocaleString(undefined,{maximumFractionDigits:0})} m²`;}
export function makeRecord(kind:Kind,geometry:PolygonGeometry,municipality=''):GISRecord {
  const now=new Date().toISOString();
  return {type:'Feature',geometry,properties:{id:uid(),kind,name:'',municipality,barangay:'',reference:'',category:CATEGORIES[kind][0],source:'Digitized by user',sourceDate:now.slice(0,10),verification:'draft',notes:'',demo:false,createdAt:now,updatedAt:now}};
}

export function demoRecords(): GISRecord[] {
  const rect=(x:number,y:number,w:number,h:number):Polygon=>({type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]});
  const sample=(kind:Kind,name:string,category:string,geometry:Polygon)=>{
    const f=makeRecord(kind,geometry,'Kalibo');
    Object.assign(f.properties,{name,category,demo:true,reference:'SYNTHETIC',source:'Synthetic demonstration geometry; not a real lot or zoning record',notes:'Demonstrates the workflow only. The polygons do not describe real property or hazard conditions.'});return f;
  };
  const records=[sample('parcel','Demo parcel 01','Unknown',rect(122.367,11.699,.003,.002)),sample('parcel','Demo parcel 02','Agricultural',rect(122.3704,11.699,.002,.002)),sample('zone','Demo residential zone','Residential',rect(122.3665,11.6985,.002,.003)),sample('zone','Demo agricultural zone','Agricultural',rect(122.3685,11.6985,.0045,.003)),sample('hazard','Demo flood overlay','Flood',rect(122.369,11.6988,.0018,.0012))];
  // Irregular example lots illustrate digitizing. They are invented, never cadastral data.
  for(let row=0;row<4;row++)for(let column=0;column<3;column++){
    const x=122.3625+column*.00125+row*.00016,y=11.6982+row*.00067,w=.00115,h=.00059;
    const ring=[[x,y],[x+w*.7,y-.00006],[x+w,y+h*.3],[x+w*.88,y+h],[x+w*.35,y+h+.00004],[x-.00008,y+h*.65],[x,y]];
    records.push(sample('parcel',`Demo parcel ${String(3+row*3+column).padStart(2,'0')}`,'Agricultural',{type:'Polygon',coordinates:[ring]}));
  }
  return records;
}

export function geojsonExport(records:GISRecord[]) { return JSON.stringify({type:'FeatureCollection',features:records,metadata:{application:'Aklan Planner',exportedAt:new Date().toISOString(),coordinateReferenceSystem:'WGS84 longitude, latitude',notice:'User-created GIS records. Draft zones and sketches are not approved zoning or certified cadastral records.'}},null,2); }
