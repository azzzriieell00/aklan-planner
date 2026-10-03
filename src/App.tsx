import { useEffect, useMemo, useRef, useState } from 'react';
import { booleanPointInPolygon, pointOnFeature } from '@turf/turf';
import { AlertTriangle, ArrowDownToLine, Check, ChevronDown, ChevronRight, ClipboardCheck, Database, Download, FileJson, FolderOpen, Layers3, MapPin, Menu, Pencil, Plus, Search, Settings2, ShieldCheck, SquareDashed, Trash2, Upload, X } from 'lucide-react';
import MapView from './MapView';
import type { MapHandle } from './MapView';
import { analyzeParcel, assertInAklan, CATEGORIES, COLORS, demoRecords, emptyWorkspace, formatArea, geojsonExport, makeRecord, MUNICIPALITIES, normalizeRecord, parseGeoJSON, uid, validateGeometry } from './gis';
import { download, readWorkspace, STORAGE_KEY, validateWorkspace, writeWorkspace } from './storage';
import { reviewReport } from './report';
import type { Analysis, Boundaries, GISRecord, Kind, PolygonGeometry, Review, Workspace } from './types';

const KIND_LABEL:Record<Kind,string>={parcel:'Parcels',zone:'Draft zones',hazard:'Hazard overlays',observation:'Observations'};
const SINGLE:Record<Kind,string>={parcel:'parcel',zone:'draft zone',hazard:'hazard overlay',observation:'observation area'};
type Modal='catalogue'|'import'|'reviews'|'settings'|'restore'|null;
const initialVisibility={parcel:true,zone:true,hazard:false,observation:true,boundaries:true};

export default function App() {
  const [boundaries,setBoundaries]=useState<Boundaries|null>(null),[municipalities,setMunicipalities]=useState<Boundaries|null>(null),[workspace,setWorkspace]=useState<Workspace>(emptyWorkspace),[ready,setReady]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null),[municipality,setMunicipality]=useState(''),[search,setSearch]=useState(''),[activeKind,setActiveKind]=useState<Kind>('parcel'),[demo,setDemo]=useState(false);
  const [visible,setVisible]=useState(initialVisibility),[opacity,setOpacity]=useState(.27),[drawKind,setDrawKind]=useState<Kind|null>(null),[editId,setEditId]=useState<string|null>(null);
  const [editor,setEditor]=useState<GISRecord|null>(null),[modal,setModal]=useState<Modal>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saved,setSaved]=useState(false),[saveError,setSaveError]=useState('');
  const [reviewNote,setReviewNote]=useState(''),[author,setAuthor]=useState(''),[reviewStatus,setReviewStatus]=useState<'draft'|'reviewed'>('draft'),[leftOpen,setLeftOpen]=useState(false),[rightOpen,setRightOpen]=useState(false),[deleteId,setDeleteId]=useState<string|null>(null);
  const [importKind,setImportKind]=useState<Kind>('parcel'),[importRecords,setImportRecords]=useState<GISRecord[]|null>(null),[importName,setImportName]=useState(''),[pendingRestore,setPendingRestore]=useState<Workspace|null>(null);
  const [mapMode,setMapMode]=useState(true),[layersCollapsed,setLayersCollapsed]=useState(false);
  const [recoveryRaw,setRecoveryRaw]=useState<string|null>(null);
  const map=useRef<MapHandle>(null),fileInput=useRef<HTMLInputElement>(null),restoreInput=useRef<HTMLInputElement>(null);
  const selected=workspace.records.find(r=>r.properties.id===selectedId)||null;
  const recordSet=workspace.records.filter(r=>r.properties.demo===demo);
  const filtered=recordSet.filter(r=>r.properties.kind===activeKind&&(!municipality||r.properties.municipality===municipality)&&[r.properties.name,r.properties.reference,r.properties.barangay,r.properties.category].join(' ').toLowerCase().includes(search.toLowerCase()));
  const analysisResult=useMemo(()=>{if(!selected||selected.properties.kind!=='parcel')return {analysis:null,error:''};try{return {analysis:analyzeParcel(selected,workspace.records),error:''}}catch(e){return {analysis:null,error:`Analysis unavailable: ${(e as Error).message}`}}},[selected,workspace.records]);
  const analysis=analysisResult.analysis;
  const announce=(message:string)=>{setNotice(message);setTimeout(()=>setNotice(''),5000);};
  const boundary=boundaries?.features[0];

  useEffect(()=>{
    const abort=new AbortController();
    Promise.all(['aklan-boundary','aklan-municipalities'].map(async name=>{const r=await fetch(`${import.meta.env.BASE_URL}data/${name}.geojson`,{signal:abort.signal});if(!r.ok)throw Error(`Boundary download returned ${r.status}`);return r.json() as Promise<Boundaries>;})).then(([province,units])=>{
      if(province.features.length!==1||units.features.length!==17)throw Error('The bundled Aklan boundary dataset is incomplete.');
      setBoundaries(province);setMunicipalities(units);
      try {const stored=readWorkspace();if(stored)setWorkspace(validateWorkspace(stored,province.features[0]));}catch(e){try{setRecoveryRaw(localStorage.getItem(STORAGE_KEY));}catch{/* Storage access may itself be unavailable. */}setError(`Saved workspace could not be loaded. Your stored copy has been preserved. ${(e as Error).message}`);setSaveError('Automatic save is paused to preserve the stored copy. Download it for recovery, then restore a valid backup to resume saving.');}
      setReady(true);
    }).catch(e=>{if(e.name!=='AbortError')setError(`Aklan boundaries could not be loaded. ${(e as Error).message}`);});
    return ()=>abort.abort();
  },[]);

  useEffect(()=>{
    if(!ready||saveError.startsWith('Automatic save is paused'))return;
    setSaved(false);
    const timer=setTimeout(()=>{try{writeWorkspace(workspace);setSaved(true);setSaveError('');}catch{setSaveError('Browser storage is full or unavailable. Export a workspace backup now; changes are still in memory.');}},350);
    return ()=>clearTimeout(timer);
  },[workspace,ready,saveError]);
  useEffect(()=>{setReviewNote('');setReviewStatus('draft');},[selectedId]);
  useEffect(()=>{
    if((!drawKind&&!editId)||editor||modal)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setDrawKind(null);setEditId(null);}};
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[drawKind,editId,editor,modal]);

  // Feature-detected WebMCP read/navigation tools use the same records and selection.
  const stateRef=useRef({workspace,select:(id:string)=>selectRecord(id)});stateRef.current={workspace,select:(id:string)=>selectRecord(id)};
  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:object,options:object)=>unknown}}).modelContext;
    if(!context?.registerTool)return;
    const life=new AbortController();
    const register=(tool:object)=>{try{Promise.resolve(context.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{/* Optional browser capability. */}};
    register({name:'list_gis_records',title:'List GIS records',description:'List the records in this device-local Aklan workspace.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object.');return stateRef.current.workspace.records.map(r=>({id:r.properties.id,name:r.properties.name,kind:r.properties.kind,municipality:r.properties.municipality,demo:r.properties.demo}));}});
    register({name:'select_gis_record',title:'Inspect GIS record',description:'Select an existing record and show its geometry and details. Does not alter GIS data.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{const value=input as {id?:unknown};if(!value||typeof value.id!=='string'||Object.keys(value).some(k=>k!=='id'))throw Error('Expected a record ID.');const r=stateRef.current.workspace.records.find(f=>f.properties.id===value.id);if(!r)throw Error('Record not found.');stateRef.current.select(value.id);return {selectedId:value.id,name:r.properties.name};}});
    return ()=>life.abort();
  },[]);

  function selectRecord(id:string) {
    const r=workspace.records.find(f=>f.properties.id===id);if(!r)return;
    cancelMapOperation();setSelectedId(id);setDemo(r.properties.demo);setActiveKind(r.properties.kind);setRightOpen(!mapMode);setLeftOpen(false);setVisible(v=>({...v,[r.properties.kind]:true}));
    if(municipality&&municipality!==r.properties.municipality)setMunicipality('');
    setTimeout(()=>map.current?.zoomRecord(r),40);
  }
  function cancelMapOperation() {setDrawKind(null);setEditId(null);}
  function startDraw(kind:Kind) {if(!boundary){setError('Wait for the Aklan boundaries to load.');return;}setDemo(false);setSelectedId(null);setDrawKind(kind);setEditId(null);setLeftOpen(false);setRightOpen(false);setError('');}
  function onDraw(geometry:PolygonGeometry) {
    const kind=drawKind;setDrawKind(null);if(!kind||!boundary)return;
    try{validateGeometry(geometry);assertInAklan(geometry,boundary);const location=municipality||municipalities?.features.find(f=>booleanPointInPolygon(pointOnFeature({type:'Feature',geometry,properties:{}}),f))?.properties.shapeName||'';setEditor(makeRecord(kind,geometry,location));setError('');}catch(e){setError((e as Error).message);}
  }
  function saveRecord(record:GISRecord) {
    if(!boundary)return;
    try {
      if(!record.properties.name.trim())throw Error('Give the record a name.');
      if(!record.properties.municipality)throw Error('Choose the Aklan municipality.');
      if(workspace.records.length>=500&&!workspace.records.some(r=>r.properties.id===record.properties.id))throw Error('Workspace limit reached. Export a backup and archive records before adding more.');
      const normalized=normalizeRecord({...record,properties:{...record.properties,updatedAt:new Date().toISOString()}},record.properties.kind,boundary,true);
      setWorkspace(w=>({...w,records:w.records.some(r=>r.properties.id===normalized.properties.id)?w.records.map(r=>r.properties.id===normalized.properties.id?normalized:r):[...w.records,normalized]}));
      setEditor(null);setDemo(normalized.properties.demo);setSelectedId(normalized.properties.id);setActiveKind(normalized.properties.kind);setVisible(v=>({...v,[normalized.properties.kind]:true}));setRightOpen(!mapMode);announce('GIS record saved.');setError('');
    }catch(e){setError((e as Error).message);}
  }
  function saveBoundary() {const geometry=map.current?.finishEdit();setEditId(null);if(!geometry||!selected)return;saveRecord({...selected,geometry});}
  function addDemo() {
    if(!boundary){setError('Wait for the Aklan boundaries to load.');return;}
    cancelMapOperation();
    const existing=workspace.records.filter(r=>r.properties.demo),missing=demoRecords().filter(r=>!existing.some(e=>e.properties.name===r.properties.name));
    if(workspace.records.length+missing.length>500){setError('Export and archive records before loading the demonstration features.');return;}
    for(const r of missing)assertInAklan(r.geometry,boundary);
    const records=[...existing,...missing];if(missing.length)setWorkspace(w=>({...w,records:[...w.records,...missing]}));
    const selected=records.find(r=>r.properties.kind==='parcel');if(selected)setSelectedId(selected.properties.id);
    setTimeout(()=>map.current?.zoomRecords(records.filter(r=>r.properties.kind==='parcel')),100);
    setDemo(true);setMunicipality('');setActiveKind('parcel');setVisible(v=>({...v,zone:!mapMode,hazard:!mapMode,parcel:true}));setRightOpen(!mapMode);setLeftOpen(false);announce('Demonstration workspace opened. All sample geometries are synthetic.');
  }
  async function readImport(file:File) {
    if(!boundary)return;
    try{if(file.size>10*1024*1024)throw Error('Choose a GeoJSON file smaller than 10 MB.');const records=parseGeoJSON(await file.text(),importKind,boundary);setImportRecords(records);setImportName(file.name);setError('');}catch(e){setError((e as Error).message);setImportRecords(null);}
  }
  function commitImport() {
    if(!importRecords)return;
    if(workspace.records.length+importRecords.length>500){setError('This import would exceed the 500-record workspace limit.');return;}
    setWorkspace(w=>({...w,records:[...w.records,...importRecords]}));setDemo(importRecords[0].properties.demo);setActiveKind(importRecords[0].properties.kind);setModal(null);setImportRecords(null);selectImported(importRecords[0]);announce(`${importRecords.length} records imported. No existing records were replaced.`);
  }
  function selectImported(r:GISRecord){setSelectedId(r.properties.id);setMunicipality('');setVisible(v=>({...v,[r.properties.kind]:true}));setRightOpen(true);setTimeout(()=>map.current?.zoomRecord(r),80);}
  function saveReview() {
    if(!selected||!analysis)return;
    if(!author.trim()||!reviewNote.trim()){setError('Add your name and a review note before saving.');return;}
    if(workspace.reviews.length>=500){setError('Review limit reached. Export and archive this workspace before continuing.');return;}
    const review:Review={id:uid(),parcelId:selected.properties.id,parcelName:selected.properties.name,recordSnapshot:structuredClone(selected),datasetSnapshot:structuredClone(workspace.records.filter(r=>['zone','hazard'].includes(r.properties.kind)&&r.properties.demo===selected.properties.demo)),note:reviewNote.trim(),author:author.trim(),status:reviewStatus,createdAt:new Date().toISOString(),finding:analysis.finding,analysis:structuredClone(analysis)};
    setWorkspace(w=>({...w,reviews:[review,...w.reviews]}));setReviewNote('');announce('Review saved with its parcel and overlay snapshots.');setError('');
  }
  async function readRestore(file:File) {
    if(!boundary)return;
    try{if(file.size>30*1024*1024)throw Error('Choose a workspace backup smaller than 30 MB.');setPendingRestore(validateWorkspace(JSON.parse(await file.text()),boundary));setError('');}catch(e){setError((e as Error).message);setPendingRestore(null);}
  }
  function deleteRecord(id:string) {setWorkspace(w=>({...w,records:w.records.filter(r=>r.properties.id!==id)}));setSelectedId(null);setDeleteId(null);setEditId(null);announce('Record deleted. Saved review snapshots are retained.');}
  const exportWorkspace=()=>download(`aklan-workspace-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(workspace,null,2));

  return <div className={`app-shell ${mapMode?'map-mode':''} ${drawKind||editId?'drawing-active':''}`}>
    <header className="app-header">
      <button className="mobile-menu icon-button" aria-label="Open layers and records" onClick={()=>{setLayersCollapsed(false);setLeftOpen(v=>!v);setRightOpen(false)}}><Menu size={21}/></button>
      <div className="brand"><div className="brand-mark"><SquareDashed size={25}/></div><div><strong>Aklan<span>Planner</span></strong><small>GIS WORKBENCH</small></div></div>
      <button className="mobile-view-toggle icon-button" aria-label={mapMode?'Switch to Workbench':'Switch to Map view'} onClick={()=>{setMapMode(v=>!v);setRightOpen(false);setLeftOpen(false)}}><Layers3 size={20}/></button>
      <nav aria-label="Main navigation"><button className={mapMode?'nav-active':''} onClick={()=>{setMapMode(true);setRightOpen(false);setModal(null)}}><MapPin size={17}/>Map view</button><button className={!mapMode?'nav-active':''} onClick={()=>{setMapMode(false);setModal(null)}}><Layers3 size={17}/>Workbench</button><button onClick={()=>setModal('catalogue')}><Database size={17}/>Data catalogue</button><button onClick={()=>setModal('reviews')}><ClipboardCheck size={17}/>Reviews<span className="nav-count">{workspace.reviews.length}</span></button></nav>
      <div className="header-end"><span className="local-state"><span className={`state-dot ${saved?'saved':''}`}/>{saved?'Saved on this device':'Local workspace'}</span><button className="icon-button" title="Workspace tools" aria-label="Workspace tools" onClick={()=>setModal('settings')}><Settings2 size={20}/></button><button className="button header-export" onClick={exportWorkspace}><Download size={16}/>Backup</button></div>
    </header>
    {error&&<div className="global-message error" role="alert"><AlertTriangle size={17}/><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}
    {saveError&&<div className="global-message error" role="alert"><AlertTriangle size={17}/><span>{saveError}</span>{recoveryRaw&&<button onClick={()=>download('aklan-recovery-original.json',recoveryRaw)}>Download stored copy</button>}<button onClick={exportWorkspace}>Export backup</button></div>}
    <div className="workspace-bar"><div className="breadcrumbs"><MapPin size={15}/><span>Aklan</span><ChevronRight size={14}/><strong>{municipality||'All municipalities'}</strong><span className="scope-badge">17 municipalities</span></div><div className="workspace-mode"><button className={!demo?'active':''} onClick={()=>{setDemo(false);setSelectedId(null);setEditId(null);setDrawKind(null)}}>My GIS</button><button className={demo?'active demo-mode':''} onClick={addDemo}>Demo</button></div></div>
    {demo&&<div className="demo-banner"><AlertTriangle size={15}/>Demonstration: these polygons are synthetic. They do not describe real lots, zoning, or hazards.</div>}
    <main className="workbench">
      {mapMode&&<button className="map-layers-toggle" onClick={()=>{setLayersCollapsed(false);setLeftOpen(true);setRightOpen(false)}}><Layers3 size={17}/>Layers & records</button>}
      <aside className={`left-panel ${leftOpen?'mobile-open':''} ${layersCollapsed?'collapsed':''}`} aria-label="Layers and records">
        <div className="panel-heading"><span>{mapMode?'MAP LAYERS · AKLAN':'EXPLORE AKLAN'}</span><button className="mobile-close icon-button" aria-label="Close layers" onClick={()=>{setLeftOpen(false);setLayersCollapsed(true)}}><X size={19}/></button></div>
        <label className="field-label" htmlFor="municipality">Municipality</label><div className="select-wrap"><select id="municipality" value={municipality} onChange={e=>{setMunicipality(e.target.value);setSelectedId(null)}}><option value="">All Aklan municipalities</option>{MUNICIPALITIES.map(name=><option key={name}>{name}</option>)}</select><ChevronDown size={15}/></div>
        <label className="search-wrap"><Search size={17}/><input aria-label="Search GIS records" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, lot, barangay…"/></label>
        <div className="section-heading"><h2>Map layers</h2><span>{Object.values(visible).filter(Boolean).length} visible</span></div>
        <div className="layer-list">{(['boundaries','parcel','zone','hazard','observation'] as const).map(kind=><label className="layer-row" key={kind}><input type="checkbox" checked={visible[kind]} onChange={e=>setVisible(v=>({...v,[kind]:e.target.checked}))}/><span className={`layer-swatch ${kind}`}/><span>{kind==='boundaries'?'Municipal boundaries':KIND_LABEL[kind]}</span><small>{kind==='boundaries'?'17':recordSet.filter(r=>r.properties.kind===kind).length}</small></label>)}</div>
        <label className="opacity-label" htmlFor="opacity">Overlay opacity<span>{Math.round(opacity*100)}%</span></label><input id="opacity" className="opacity-range" type="range" min="0.05" max="0.75" step="0.01" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/>
        <div className="legend">{Object.entries(COLORS).filter(([name])=>recordSet.some(r=>r.properties.category===name&&visible[r.properties.kind])).map(([name,color])=><span key={name}><i style={{background:color}}/>{name}</span>)}</div>
        <div className="section-heading records-heading"><h2>Your records</h2><button className="text-button" onClick={()=>{setModal('import');setImportRecords(null)}}><Upload size={14}/>Import</button></div>
        <div className="record-tabs" role="tablist" aria-label="Record categories">{(['parcel','zone','hazard','observation'] as Kind[]).map(kind=><button role="tab" aria-selected={activeKind===kind} key={kind} className={activeKind===kind?'active':''} onClick={()=>setActiveKind(kind)} title={KIND_LABEL[kind]}>{kind==='parcel'?'Parcels':kind==='zone'?'Zones':kind==='hazard'?'Hazards':'Notes'}</button>)}</div>
        <div className="records-list">{filtered.length?filtered.map(r=><button className={`record-row ${selectedId===r.properties.id?'selected':''}`} key={r.properties.id} onClick={()=>selectRecord(r.properties.id)}><span className={`record-icon ${r.properties.kind}`}><SquareDashed size={16}/></span><span><strong>{r.properties.name}</strong><small>{r.properties.municipality||'Location not recorded'} · {r.properties.demo?'Demo':r.properties.category}</small></span><ChevronRight size={16}/></button>):<div className="list-empty"><FolderOpen size={24}/><strong>{search?'No matching records':`No ${KIND_LABEL[activeKind].toLowerCase()} yet`}</strong><p>{search?'Try another name or reference.':'Draw on the map or import a GeoJSON file.'}</p></div>}</div>
        <div className="left-footer"><ShieldCheck size={16}/><span>Open boundaries · 2020 reference<br/><button onClick={()=>setModal('catalogue')}>View sources and limitations</button></span></div>
      </aside>
      <div className="map-column">
        <div className="drawing-toolbar"><span className="toolbar-label"><Pencil size={16}/>CREATE GIS DATA</span>{(['parcel','zone','hazard','observation'] as Kind[]).map(kind=><button key={kind} className={drawKind===kind?'active':''} disabled={!ready||!!editId} onClick={()=>startDraw(kind)}><Plus size={15}/>{kind==='parcel'?'Parcel':kind==='zone'?'Draft zone':kind==='hazard'?'Hazard':'Observation'}</button>)}{drawKind&&<button className="cancel-draw" onClick={()=>setDrawKind(null)}><X size={15}/>Cancel</button>}{editId&&<><button className="active" onClick={saveBoundary}><Check size={15}/>Save boundary</button><button onClick={()=>setEditId(null)}>Cancel</button></>}</div>
        <MapView ref={map} boundaries={boundaries} municipalities={municipalities} records={recordSet} selectedId={selectedId} municipality={municipality} visible={visible} opacity={opacity} drawKind={drawKind} editId={editId} mapMode={mapMode} showPopup={mapMode&&!rightOpen} onSelect={selectRecord} onDraw={onDraw} onCancel={cancelMapOperation} onSaveBoundary={saveBoundary} onInspect={()=>setRightOpen(true)} onClosePopup={()=>setSelectedId(null)}/>
        <div className="map-bottom-bar"><span>{recordSet.length} {demo?'demo':'workspace'} records<span className="separator">/</span>{recordSet.filter(r=>r.properties.kind==='parcel').length} parcels</span><button className="text-button" disabled={!recordSet.length} onClick={()=>download(demo?'aklan-demo.geojson':'aklan-my-gis.geojson',geojsonExport(recordSet),'application/geo+json')}><ArrowDownToLine size={15}/>Export GeoJSON</button></div>
      </div>
      <aside className={`detail-panel ${rightOpen?'mobile-open':''}`} aria-label="Record inspection">
        <div className="detail-heading"><span>RECORD INSPECTION</span><button className="mobile-close icon-button" aria-label="Close record details" onClick={()=>setRightOpen(false)}><X size={19}/></button></div>
        {selected?<>
          <div className="detail-title"><div className={`kind-pill ${selected.properties.demo?'demo-pill':''}`}>{selected.properties.demo?'DEMO':SINGLE[selected.properties.kind].toUpperCase()}</div><h1>{selected.properties.name}</h1><p><MapPin size={14}/>{[selected.properties.barangay,selected.properties.municipality,'Aklan'].filter(Boolean).join(', ')}</p></div>
          <div className="detail-actions"><button className="button" onClick={()=>{setEditor(structuredClone(selected));setError('')}}><Pencil size={14}/>Edit details</button><button className="icon-button delete-button" title="Delete record" aria-label="Delete record" onClick={()=>setDeleteId(selected.properties.id)}><Trash2 size={16}/></button></div>
          <dl className="record-facts"><div><dt>Reference</dt><dd>{selected.properties.reference||'Not recorded'}</dd></div><div><dt>Recorded use / class</dt><dd>{selected.properties.category}</dd></div><div><dt>Record status</dt><dd>{selected.properties.verification.replace('_',' ')}</dd></div><div><dt>Source date</dt><dd>{selected.properties.sourceDate||'Unknown'}</dd></div></dl>
          <div className="source-note"><Database size={15}/><div><strong>Source</strong><p>{selected.properties.source}</p></div></div>
          <button className="boundary-edit text-button" disabled={!!drawKind||!!editId} onClick={()=>{setEditId(selected.properties.id);setRightOpen(false);map.current?.zoomRecord(selected)}}><SquareDashed size={15}/>Edit boundary on map</button>
          {analysisResult.error&&<div className="inline-alert" role="alert">{analysisResult.error}</div>}
          {analysis?<>
            <div className="area-summary"><span>Calculated parcel area</span><strong>{formatArea(analysis.area)}</strong><small>Geometry estimate · WGS84 spherical area</small></div>
            <div className="finding"><AlertTriangle size={17}/><div><strong>{analysis.finding}</strong><p>Map evidence for your assessment. No automatic legal approval.</p></div></div>
            <OverlapSection label="Zone overlaps" entries={analysis.zones}/><div className="coverage-note">Available zone coverage <strong>{analysis.zoneCoverage.toFixed(1)}%</strong></div>
            <OverlapSection label="Hazard overlaps" entries={analysis.hazards}/>
            <details className="analysis-limits"><summary>Method and limitations</summary><ul>{analysis.warnings.map(w=><li key={w}>{w}</li>)}</ul><p>Percentages describe intersected area. They are not confidence scores. Draft zones need independent validation.</p></details>
            <section className="review-form"><div className="section-heading"><h2>Planner review</h2><ClipboardCheck size={17}/></div><label>Your name<input value={author} maxLength={100} onChange={e=>setAuthor(e.target.value)} placeholder="Reviewer name"/></label><label>Assessment<textarea value={reviewNote} maxLength={10000} onChange={e=>setReviewNote(e.target.value)} placeholder="Record your findings, evidence, and next checks…" rows={4}/></label><label>Review state<select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value as 'draft'|'reviewed')}><option value="draft">Draft assessment</option><option value="reviewed">Reviewed assessment</option></select></label><button className="button primary full-width" onClick={saveReview}><Check size={16}/>Save review</button><small>Stores the parcel and overlay snapshots used in this review.</small></section>
          </>:<div className="nonparcel-note"><AlertTriangle size={17}/><p>{selected.properties.kind==='zone'?'This is a user-maintained draft zone. It is not an approved zoning designation.':selected.properties.kind==='hazard'?'This overlay carries your recorded source. A drawn hazard polygon does not certify hazard exposure.':'A dated observation supports review; it does not establish a legal zoning designation.'}</p></div>}
          {selected.properties.notes&&<div className="record-notes"><h2>Record notes</h2><p>{selected.properties.notes}</p></div>}
        </>:<div className="inspection-empty"><div className="empty-map-icon"><SquareDashed size={38}/><MapPin size={20}/></div><h1>Your map.<br/>Your GIS records.</h1><p>Create a parcel, draw a draft zone, or import your own GeoJSON. Select a record to inspect its details.</p><button className="button primary" disabled={!ready} onClick={()=>startDraw('parcel')}><Plus size={17}/>Draw your first parcel</button><button className="button secondary" disabled={!ready} onClick={addDemo}>Explore the demonstration</button><div className="empty-note"><ShieldCheck size={18}/><span>Saved on this device.<br/>Export a backup to keep your own copy.</span></div><p className="tiny-note">Administrative context is open data. Your sketches and draft zones remain your own records.</p></div>}
      </aside>
    </main>
    <div className="mobile-bottom"><button onClick={()=>{setLeftOpen(true);setRightOpen(false)}}><Layers3 size={18}/>Layers</button><button onClick={()=>{setRightOpen(true);setLeftOpen(false)}}><SquareDashed size={18}/>Inspect</button><button onClick={()=>setModal('settings')}><Settings2 size={18}/>Workspace</button></div>
    {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {editor&&<RecordEditor record={editor} onClose={()=>{setEditor(null);setError('')}} onSave={saveRecord} error={error}/>}
    {deleteId&&<Dialog title="Delete this GIS record?" onClose={()=>setDeleteId(null)}><p>The record will be removed from this workspace. Saved review snapshots remain available.</p><div className="dialog-actions"><button className="button" onClick={()=>setDeleteId(null)}>Cancel</button><button className="button danger" onClick={()=>deleteRecord(deleteId)}>Delete record</button></div></Dialog>}
    {modal==='catalogue'&&<Dialog title="Data catalogue" onClose={()=>setModal(null)} wide><p className="dialog-intro">Source information travels with your records. Boundaries are bundled; your own overlays are maintained in this workspace.</p><div className="catalogue-grid"><SourceCard title="Aklan administrative boundaries" badge="BUNDLED · OPEN DATA" text="Province and 17 municipalities. Simplified geoBoundaries geometry, based on NAMRIA / PSA / OCHA sources; 2020 reference year. Administrative context, not certified parcel geometry." href="https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM2/" link="View source metadata"/><SourceCard title="Esri World Imagery" badge="ONLINE BASEMAP" text="Satellite and aerial image background. Provider dates and resolution vary by location. Imagery does not establish lot boundaries or legal zoning." href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" link="View imagery source"/><SourceCard title="Your GIS workspace" badge={`${workspace.records.filter(r=>!r.properties.demo).length} USER RECORDS`} text="Draw or import parcels, draft zones, hazard overlays, and observation areas. Every record has a source, date, verification label, and notes. Data stays in this browser until you export it."/><SourceCard title="Further open-data sources" badge="AVAILABLE TO PREPARE" text="OpenStreetMap offers roads and mapped facilities; ESA WorldCover offers dated land cover. Prepare suitable Aklan polygon layers and retain their licenses before importing." href="https://esa-worldcover.org/en/data-access" link="View WorldCover access"/></div><div className="inline-alert"><AlertTriangle size={17}/>No official zoning or hazard coverage is bundled. Drawn zones are planning drafts, and missing hazard overlap does not prove safety.</div><div className="dialog-actions"><button className="button primary" onClick={()=>{setModal('import');setImportRecords(null)}}><Upload size={16}/>Import your data</button><button className="button" onClick={()=>download(demo?'aklan-demo.geojson':'aklan-my-gis.geojson',geojsonExport(recordSet),'application/geo+json')}><Download size={16}/>Export active records</button></div></Dialog>}
    {modal==='import'&&<Dialog title="Import GeoJSON" onClose={()=>{setModal(null);setImportRecords(null);setError('')}}><p className="dialog-intro">Import WGS84 Polygon or MultiPolygon features inside Aklan. Keep source and date fields where available. Up to 500 features and 10 MB per file.</p><label className="field-label">Default record type<select value={importKind} onChange={e=>{setImportKind(e.target.value as Kind);setImportRecords(null)}}>{(Object.keys(KIND_LABEL) as Kind[]).map(kind=><option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</select></label><input ref={fileInput} type="file" accept=".json,.geojson,application/json,application/geo+json" className="file-picker" aria-label="Choose GeoJSON file" onChange={e=>{const file=e.target.files?.[0];if(file)void readImport(file);e.target.value=''}}/>{error&&<p className="form-error" role="alert">{error}</p>}{importRecords&&<div className="import-preview"><Check size={18}/><div><strong>{importName}</strong><p>{importRecords.length} valid features · {new Set(importRecords.map(r=>r.properties.municipality||'Unassigned')).size} municipality labels</p><small>Existing data is retained. Imported draft records remain drafts.</small></div></div>}<div className="dialog-actions"><button className="button" onClick={()=>setModal(null)}>Cancel</button><button className="button primary" disabled={!importRecords} onClick={commitImport}>Import {importRecords?.length||''} records</button></div></Dialog>}
    {modal==='reviews'&&<Dialog title="Saved parcel reviews" onClose={()=>setModal(null)} wide><p className="dialog-intro">Each saved review retains the parcel and overlays used at that time. Editing or deleting a current record does not alter its saved assessment.</p>{workspace.reviews.length?<div className="review-list">{workspace.reviews.map(review=><article className="saved-review" key={review.id}><div><span className="kind-pill">{review.recordSnapshot.properties.demo?'DEMO':review.status.toUpperCase()}</span><h2>{review.parcelName}</h2><p>{review.author} · {new Date(review.createdAt).toLocaleString()}</p><p className="saved-review-note">{review.note}</p><small>{review.finding} · {formatArea(review.analysis.area)}</small></div><button className="button" onClick={()=>download(`${review.parcelName.replace(/[^a-zA-Z0-9_-]/g,'-')}-review.html`,reviewReport(review),'text/html')}><Download size={15}/>Report</button></article>)}</div>:<div className="large-empty"><ClipboardCheck size={35}/><h2>No reviews saved yet</h2><p>Select a parcel, add your assessment, and save a review.</p></div>}</Dialog>}
    {modal==='settings'&&<Dialog title="Workspace tools" onClose={()=>setModal(null)}><p className="dialog-intro">This version is a personal, device-local workbench. Browser storage is not a shared LGU database. Clearing browser data removes local records; keep exported backups.</p><div className="workspace-tools"><button onClick={exportWorkspace}><Download size={20}/><span><strong>Export workspace backup</strong><small>All records and saved review snapshots</small></span><ChevronRight size={18}/></button><button onClick={()=>{setModal('restore');setPendingRestore(null)}}><Upload size={20}/><span><strong>Restore a workspace backup</strong><small>Preview before replacing the current workspace</small></span><ChevronRight size={18}/></button><button onClick={()=>download('aklan-my-gis.geojson',geojsonExport(workspace.records.filter(r=>!r.properties.demo)),'application/geo+json')}><FileJson size={20}/><span><strong>Export my GIS as GeoJSON</strong><small>Use your polygon records in QGIS or another map</small></span><ChevronRight size={18}/></button></div><p className="tiny-note">Source code is ready for GitHub. Keep private workspace exports and personal evidence outside a public repository.</p></Dialog>}
    {modal==='restore'&&<Dialog title="Restore workspace" onClose={()=>{setModal(null);setPendingRestore(null);setError('')}}><p className="dialog-intro">Choose an exported Aklan Planner workspace backup. Restoring replaces the current records and reviews. Export your current backup first.</p><button className="text-button" onClick={exportWorkspace}><Download size={15}/>Export current backup</button><input ref={restoreInput} type="file" accept=".json,application/json" className="file-picker" aria-label="Choose workspace backup" onChange={e=>{const f=e.target.files?.[0];if(f)void readRestore(f);e.target.value=''}}/>{error&&<p className="form-error" role="alert">{error}</p>}{pendingRestore&&<div className="import-preview"><Database size={20}/><div><strong>Backup validated</strong><p>{pendingRestore.records.length} records · {pendingRestore.reviews.length} reviews</p></div></div>}<div className="dialog-actions"><button className="button" onClick={()=>setModal(null)}>Cancel</button><button className="button danger" disabled={!pendingRestore} onClick={()=>{if(pendingRestore){setWorkspace(pendingRestore);setSaveError('');setSelectedId(null);setDemo(false);setModal(null);setPendingRestore(null);announce('Workspace restored.')}}}>Replace workspace</button></div></Dialog>}
  </div>;
}

function OverlapSection({label,entries}:{label:string;entries:Analysis['zones']}) {return <section className="overlap-section"><div className="section-heading"><h2>{label}</h2><span>{entries.length}</span></div>{entries.length?entries.map((entry,index)=><div className="overlap-row" key={`${entry.name}-${index}`}><div><i style={{background:COLORS[entry.category]||'#72bba8'}}/><span><strong>{entry.name}</strong><small>{entry.category} · {formatArea(entry.area)}</small></span><b>{entry.percent.toFixed(1)}%</b></div><div className="overlap-bar"><span style={{width:`${Math.min(100,entry.percent)}%`,background:COLORS[entry.category]||'#72bba8'}}/></div></div>):<p className="no-overlap">No mapped overlap in the available layers.<br/><strong>Coverage is incomplete or unknown.</strong></p>}</section>}
function SourceCard({title,badge,text,href,link}:{title:string;badge:string;text:string;href?:string;link?:string}) {return <article className="source-card"><span>{badge}</span><h2>{title}</h2><p>{text}</p>{href&&<a href={href} target="_blank" rel="noopener noreferrer">{link}</a>}</article>}
function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  return <dialog ref={dialog} className={`dialog ${wide?'wide':''}`} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}}><div className="dialog-heading"><h1>{title}</h1><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21}/></button></div><div className="dialog-body">{children}</div></dialog>;
}
function RecordEditor({record,onClose,onSave,error}:{record:GISRecord;onClose:()=>void;onSave:(record:GISRecord)=>void;error:string}) {
  const [draft,setDraft]=useState(record);const p=draft.properties;
  const change=(key:keyof GISRecord['properties'],value:string)=>setDraft(d=>({...d,properties:{...d.properties,[key]:value}}));
  return <Dialog title={`${record.properties.name?'Edit':'Create'} ${SINGLE[p.kind]}`} onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(draft)}}><p className="dialog-intro">Record the source and date. A polygon you draw is a draft until independently verified.</p><div className="editor-grid"><label className="span-two">Record name<input autoFocus required maxLength={100} value={p.name} onChange={e=>change('name',e.target.value)} placeholder={p.kind==='parcel'?'e.g. Field parcel 001':'A descriptive record name'}/></label><label>Municipality<select required value={p.municipality} onChange={e=>change('municipality',e.target.value)}><option value="">Choose municipality</option>{MUNICIPALITIES.map(name=><option key={name}>{name}</option>)}</select></label><label>Barangay<input maxLength={100} value={p.barangay} onChange={e=>change('barangay',e.target.value)} placeholder="Optional"/></label><label>Lot / document reference<input maxLength={100} value={p.reference} onChange={e=>change('reference',e.target.value)} placeholder="Your record reference"/></label><label>{p.kind==='zone'?'Draft zone class':p.kind==='hazard'?'Hazard type':'Observed use / category'}<select value={p.category} onChange={e=>change('category',e.target.value)}>{Array.from(new Set([...CATEGORIES[p.kind],p.category])).map(category=><option key={category}>{category}</option>)}</select></label><label className="span-two">Source<input maxLength={200} required value={p.source} onChange={e=>change('source',e.target.value)} placeholder="Field collection, published dataset, or digitized source"/></label><label>Source date<input type="date" value={p.sourceDate} onChange={e=>change('sourceDate',e.target.value)}/></label><label>Verification label<select value={p.verification} onChange={e=>change('verification',e.target.value)}><option value="draft">Draft / unverified</option><option value="field_observed">Field observed</option><option value="source_record">Source record attached / referenced</option></select></label><label className="span-two">Notes<textarea rows={3} maxLength={4000} value={p.notes} onChange={e=>change('notes',e.target.value)} placeholder="Method, accuracy, evidence, and limitations"/></label></div>{p.kind==='zone'&&<p className="inline-alert">Draft zone classes describe your proposed planning layer. They do not establish approved legal zoning.</p>}{p.demo&&<p className="inline-alert">This record remains labeled as synthetic demonstration data.</p>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit"><Check size={16}/>Save record</button></div></form></Dialog>;
}
