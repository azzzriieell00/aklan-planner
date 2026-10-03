import { analyzeParcel, normalizeRecord } from './gis';
import type { GeometryFeature, GISRecord, Review, Workspace } from './types';

export const STORAGE_KEY='aklan-planner.workspace.v1';
export function readWorkspace(): unknown {
  const raw=localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function validateWorkspace(input: unknown,boundary:GeometryFeature):Workspace {
  if(!input||typeof input!=='object')throw Error('Invalid workspace backup.');
  const w=input as Workspace;
  if(w.version!==1||!Array.isArray(w.records)||!Array.isArray(w.reviews))throw Error('Choose an Aklan Planner version 1 workspace backup.');
  if(w.records.length>500||w.reviews.length>500)throw Error('This local version supports up to 500 records and 500 reviews per workspace.');
  const records=w.records.map(r=>normalizeRecord(r,'parcel',boundary,true));
  if(new Set(records.map(r=>r.properties.id)).size!==records.length)throw Error('Backup has duplicate record IDs.');
  const reviews:Review[]=w.reviews.map(r=>{
    if(!r||typeof r!=='object'||typeof r.id!=='string'||typeof r.parcelId!=='string'||typeof r.note!=='string'||typeof r.author!=='string'||!['draft','reviewed'].includes(r.status)||!Array.isArray(r.datasetSnapshot)||r.datasetSnapshot.length>500||typeof r.createdAt!=='string'||!r.analysis||typeof r.analysis.area!=='number'||!Array.isArray(r.analysis.zones)||!Array.isArray(r.analysis.hazards)||!Array.isArray(r.analysis.warnings))throw Error('Backup includes a malformed review.');
    const recordSnapshot=normalizeRecord(r.recordSnapshot,'parcel',boundary,true);
    if(recordSnapshot.properties.kind!=='parcel'||recordSnapshot.properties.id!==r.parcelId)throw Error('Review parcel snapshot does not match its reference.');
    const datasetSnapshot:GISRecord[]=r.datasetSnapshot.map(f=>normalizeRecord(f,'zone',boundary,true));
    // Analysis is re-derived from the recorded snapshots, never trusted from an imported file.
    const analysis=analyzeParcel(recordSnapshot,datasetSnapshot);
    return {...r,id:r.id.slice(0,100),parcelName:recordSnapshot.properties.name,note:r.note.slice(0,10000),author:r.author.slice(0,100),recordSnapshot,datasetSnapshot,analysis,finding:analysis.finding};
  });
  if(new Set(reviews.map(r=>r.id)).size!==reviews.length)throw Error('Backup has duplicate review IDs.');
  return {version:1,records,reviews};
}
export function writeWorkspace(workspace:Workspace) {localStorage.setItem(STORAGE_KEY,JSON.stringify(workspace));}
export function download(name:string,text:string,mime='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type:mime}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
