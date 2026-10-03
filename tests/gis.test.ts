import { describe,it,expect } from 'vitest';
import { area } from '@turf/turf';
import { readFileSync } from 'node:fs';
import { analyzeParcel, assertInAklan, demoRecords, makeRecord, normalizeRecord, parseGeoJSON, validateGeometry } from '../src/gis';
import { validateWorkspace } from '../src/storage';
import { reviewReport } from '../src/report';
import type { Boundaries, GeometryFeature, PolygonGeometry, Review } from '../src/types';

const bounds=JSON.parse(readFileSync('public/data/aklan-boundary.geojson','utf8')) as Boundaries;
const rectangle=(west:number,south:number,width:number,height:number):PolygonGeometry=>({type:'Polygon',coordinates:[[[west,south],[west+width,south],[west+width,south+height],[west,south+height],[west,south]]]});
const syntheticBoundary:GeometryFeature={type:'Feature',properties:{},geometry:rectangle(120,10,4,4)};
const parcel=()=>makeRecord('parcel',rectangle(122.3,11.6,.004,.002),'Kalibo');
describe('GIS screening',()=>{
  it('reports a parcel split between two zones, instead of choosing the centroid zone',()=>{
    const p=parcel(),a=makeRecord('zone',rectangle(122.3,11.6,.002,.002)),b=makeRecord('zone',rectangle(122.302,11.6,.002,.002));
    a.properties.category='Residential';b.properties.category='Agricultural';
    const result=analyzeParcel(p,[a,b]);expect(result.zones).toHaveLength(2);expect(result.zones[0].percent).toBeCloseTo(50,4);expect(result.zoneCoverage).toBeCloseTo(100,4);expect(result.conflictingZones).toBe(false);
  });
  it('uses union coverage and flags overlapping draft zones',()=>{
    const p=parcel(),a=makeRecord('zone',p.geometry),b=makeRecord('zone',p.geometry);
    const result=analyzeParcel(p,[a,b]);expect(result.zoneCoverage).toBeCloseTo(100,5);expect(result.conflictingZones).toBe(true);expect(result.zones).toHaveLength(2);
  });
  it('reports incomplete zoning and unknown hazard coverage',()=>{
    const p=parcel(),a=makeRecord('zone',rectangle(122.3,11.6,.001,.002));const result=analyzeParcel(p,[a]);
    expect(result.zoneCoverage).toBeCloseTo(25,4);expect(result.warnings.some(w=>w.includes('75.0%'))).toBe(true);expect(result.warnings.some(w=>w.includes('not proof of safety'))).toBe(true);
    expect(analyzeParcel(p,[]).finding).toBe('Insufficient zoning data');
  });
  it('does not treat a touching edge as positive area overlap',()=>{
    const p=parcel(),a=makeRecord('zone',rectangle(122.304,11.6,.002,.002));expect(analyzeParcel(p,[a]).zones).toHaveLength(0);
  });
  it('isolates synthetic overlays from user records',()=>{
    const p=parcel(),a=makeRecord('zone',p.geometry);a.properties.demo=true;expect(analyzeParcel(p,[a]).zones).toHaveLength(0);
    p.properties.demo=true;expect(analyzeParcel(p,[a]).zones).toHaveLength(1);expect(analyzeParcel(p,[a]).finding).toBe('Demonstration only');
  });
  it('supports holes and multipolygon area',()=>{
    const outer=rectangle(122.3,11.6,.004,.004) as GeoJSON.Polygon,inner=rectangle(122.301,11.601,.002,.002) as GeoJSON.Polygon;
    const withHole={type:'Polygon' as const,coordinates:[outer.coordinates[0],inner.coordinates[0]]};validateGeometry(withHole);
    expect(area({type:'Feature',properties:{},geometry:withHole})).toBeCloseTo(area({type:'Feature',properties:{},geometry:outer})-area({type:'Feature',properties:{},geometry:inner}),5);
    const multi={type:'MultiPolygon' as const,coordinates:[rectangle(122.3,11.6,.001,.001).coordinates as GeoJSON.Position[][],rectangle(122.302,11.6,.001,.001).coordinates as GeoJSON.Position[][]]};expect(validateGeometry(multi).type).toBe('MultiPolygon');
  });
});
describe('data validation',()=>{
  it('bundles exactly one Aklan province and 17 unique municipalities',()=>{
    const units=JSON.parse(readFileSync('public/data/aklan-municipalities.geojson','utf8')) as Boundaries;
    expect(bounds.features).toHaveLength(1);expect(bounds.features[0].properties.shapeName).toBe('Aklan');expect(units.features).toHaveLength(17);expect(new Set(units.features.map(f=>f.properties.shapeName)).size).toBe(17);
  });
  it('preserves island geometry and admits the synthetic workflow in Aklan',()=>{
    expect(bounds.features[0].geometry.type).toBe('MultiPolygon');for(const r of demoRecords())expect(()=>assertInAklan(r.geometry,bounds.features[0])).not.toThrow();
  });
  it('rejects out-of-Aklan geometry',()=>expect(()=>assertInAklan(rectangle(123,14,.001,.001),bounds.features[0])).toThrow('outside'));
  it('rejects crossing edges, unclosed rings, invalid coordinates, empty polygons, and points',()=>{
    expect(()=>validateGeometry({type:'Polygon',coordinates:[[[122,11],[122.01,11.01],[122,11.01],[122.01,11],[122,11]]]})).toThrow('cross');
    expect(()=>validateGeometry({type:'Polygon',coordinates:[[[122,11],[122.01,11],[122.01,11.01],[122,11.01]]]})).toThrow('closed');
    expect(()=>validateGeometry({type:'Polygon',coordinates:[[[999,11],[122,11],[122,12],[999,11]]]})).toThrow('WGS84');
    expect(()=>validateGeometry({type:'Polygon',coordinates:[]})).toThrow('Empty');expect(()=>validateGeometry({type:'Point',coordinates:[122,11]})).toThrow('Polygon');
  });
  it('rejects overlapping multipolygon parts and holes outside the shell',()=>{
    const rectangleA=rectangle(122,11,.01,.01) as GeoJSON.Polygon;
    expect(()=>validateGeometry({type:'MultiPolygon',coordinates:[rectangleA.coordinates,rectangleA.coordinates]})).toThrow('overlap');
    expect(()=>validateGeometry({type:'Polygon',coordinates:[rectangleA.coordinates[0],(rectangle(123,12,.001,.001) as GeoJSON.Polygon).coordinates[0]]})).toThrow('hole');
  });
  it('imports atomically, normalizes IDs, and rejects invalid municipality labels',()=>{
    const p=parcel();p.properties.name='My parcel';const imported=parseGeoJSON(JSON.stringify({type:'FeatureCollection',features:[p]}),'parcel',syntheticBoundary);expect(imported[0].properties.name).toBe('My parcel');expect(imported[0].properties.id).not.toBe(p.properties.id);
    p.properties.municipality='Iloilo';expect(()=>normalizeRecord(p,'parcel',syntheticBoundary)).toThrow('Unknown Aklan');
    expect(()=>parseGeoJSON(JSON.stringify({type:'FeatureCollection',features:[parcel(),{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[122.3,11.6]}}]}),'parcel',syntheticBoundary)).toThrow('Feature 2');
  });
  it('does not silently accept a legacy CRS declaration',()=>expect(()=>parseGeoJSON(JSON.stringify({type:'FeatureCollection',crs:{type:'name',properties:{name:'EPSG:3857'}},features:[parcel()]}),'parcel',syntheticBoundary)).toThrow('Reproject'));
});
describe('review persistence and reports',()=>{
  function review():Review {
    const p=parcel();p.properties.name='<script>alert(1)</script>';const zones=[makeRecord('zone',p.geometry)];const analysis=analyzeParcel(p,zones);
    return {id:'review1',parcelId:p.properties.id,parcelName:p.properties.name,recordSnapshot:p,datasetSnapshot:zones,note:'<img src=x onerror=alert(1)>',author:'Tester',status:'draft',createdAt:new Date().toISOString(),finding:analysis.finding,analysis};
  }
  it('restores review snapshots even after the current parcel has been deleted',()=>{
    const r=review();const workspace=validateWorkspace({version:1,records:[],reviews:[r]},syntheticBoundary);expect(workspace.reviews[0].recordSnapshot.properties.id).toBe(r.parcelId);expect(workspace.reviews[0].analysis.zoneCoverage).toBeCloseTo(100,4);
  });
  it('recomputes imported analysis from saved snapshots',()=>{
    const r=review();r.analysis.zoneCoverage=0;r.finding='Officially approved';const workspace=validateWorkspace({version:1,records:[],reviews:[r]},syntheticBoundary);expect(workspace.reviews[0].analysis.zoneCoverage).toBeCloseTo(100,4);expect(workspace.reviews[0].finding).not.toBe('Officially approved');
  });
  it('preserves record IDs and dates across a backup restore',()=>{
    const p=parcel();p.properties.updatedAt='2026-10-01T00:00:00.000Z';const result=validateWorkspace({version:1,records:[p],reviews:[]},syntheticBoundary);expect(result.records[0].properties.id).toBe(p.properties.id);expect(result.records[0].properties.updatedAt).toBe(p.properties.updatedAt);
  });
  it('rejects duplicate IDs and malformed reviews',()=>{
    const p=parcel();expect(()=>validateWorkspace({version:1,records:[p,p],reviews:[]},syntheticBoundary)).toThrow('duplicate');expect(()=>validateWorkspace({version:1,records:[],reviews:[{}]},syntheticBoundary)).toThrow('malformed');
  });
  it('escapes user-supplied report text and retains the limits',()=>{
    const html=reviewReport(review());expect(html).not.toContain('<script>alert(1)</script>');expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;script&gt;');expect(html).toContain('not a permit');expect(html).toContain('not proof of safety');
  });
});
