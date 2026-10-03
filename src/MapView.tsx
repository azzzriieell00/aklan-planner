import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import * as Esri from 'esri-leaflet';
import 'leaflet-draw';
import { Check, Crosshair, Expand, Layers3, MousePointer2, Undo2, X } from 'lucide-react';
import { analyzeParcel, COLORS, formatArea } from './gis';
import { area } from '@turf/turf';
import type { Boundaries, GISRecord, Kind, PolygonGeometry } from './types';

export interface MapHandle {home:()=>void;zoomRecord:(record:GISRecord)=>void;zoomRecords:(records:GISRecord[])=>void;finishEdit:()=>PolygonGeometry|null;}
interface Props {
  boundaries:Boundaries|null;municipalities:Boundaries|null;records:GISRecord[];selectedId:string|null;
  municipality:string;visible:Record<Kind|'boundaries',boolean>;opacity:number;drawKind:Kind|null;editId:string|null;
  mapMode:boolean;showPopup:boolean;onInspect:()=>void;onClosePopup:()=>void;
  onSelect:(id:string)=>void;onDraw:(geometry:PolygonGeometry)=>void;onCancel:()=>void;onSaveBoundary:()=>void;
}
const MapView=forwardRef<MapHandle,Props>(function MapView(props,ref) {
  type EditablePolygon=L.Polygon & {editing:{enable:()=>void;disable:()=>void}};
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<L.DrawMap|null>(null),group=useRef<L.GeoJSON|null>(null),provinceLayer=useRef<L.GeoJSON|null>(null),municipalLayer=useRef<L.GeoJSON|null>(null),drawer=useRef<L.Draw.Polygon|null>(null),editing=useRef<EditablePolygon|null>(null);
  const callbacks=useRef(props);callbacks.current=props;
  const popupHost=useRef<HTMLDivElement|null>(null);
  const [coords,setCoords]=useState('Aklan, Philippines'),[imageryState,setImageryState]=useState('Loading imagery');
  const [cornerCount,setCornerCount]=useState(0);

  useImperativeHandle(ref,()=>({
    home(){ if(provinceLayer.current)mapRef.current?.fitBounds(provinceLayer.current.getBounds(),{padding:[20,20]}); },
    zoomRecord(record){mapRef.current?.fitBounds(L.geoJSON(record).getBounds(),{paddingTopLeft:[65,70],paddingBottomRight:callbacks.current.mapMode&&container.current!.clientWidth>760?[350,70]:[65,70],maxZoom:18,animate:false});},
    zoomRecords(records){if(records.length)mapRef.current?.fitBounds(L.geoJSON(records).getBounds(),{paddingTopLeft:[155,70],paddingBottomRight:callbacks.current.mapMode&&container.current!.clientWidth>760?[350,70]:[30,70],maxZoom:17,animate:false});},
    finishEdit(){if(!editing.current)return null;const shape=editing.current.toGeoJSON().geometry as PolygonGeometry;editing.current.editing.disable();editing.current=null;return shape;},
  }),[]);

  useEffect(()=>{
    if(!container.current)return;
    const map=L.map(container.current,{zoomControl:false,minZoom:9,maxZoom:20,preferCanvas:false}).setView([11.65,122.2],10);mapRef.current=map;
    L.control.zoom({position:'bottomleft'}).addTo(map);
    map.createPane('municipalities');map.getPane('municipalities')!.style.zIndex='410';
    map.createPane('records');map.getPane('records')!.style.zIndex='430';
    const key=import.meta.env.VITE_ARCGIS_API_KEY;
    const tiles=Esri.tiledMapLayer({url:key?'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer':'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',token:key||undefined,maxZoom:20,maxNativeZoom:19}).addTo(map);
    const imagery:L.Layer=tiles;
    tiles.on('load',()=>setImageryState('Esri World Imagery'));
    tiles.on('tileerror',()=>setImageryState('Some imagery tiles unavailable'));
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    map.attributionControl.addAttribution('<a href="https://www.geoboundaries.org" target="_blank" rel="noopener noreferrer">Boundaries: geoBoundaries / NAMRIA / PSA / OCHA</a>');
    L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
    map.on('mousemove',(e:L.LeafletMouseEvent)=>setCoords(`${e.latlng.lat.toFixed(5)}° N, ${e.latlng.lng.toFixed(5)}° E`));
    map.on(L.Draw.Event.CREATED,(event)=>{
      const shape=(event as L.DrawEvents.Created).layer as L.Polygon;
      const geometry=shape.toGeoJSON().geometry as PolygonGeometry;
      callbacks.current.onDraw(geometry);
    });
    map.on(L.Draw.Event.DRAWVERTEX,event=>setCornerCount((event as L.DrawEvents.DrawVertex).layers.getLayers().length));
    const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(container.current);
    return ()=>{observer.disconnect();drawer.current?.disable();imagery.remove();map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    const map=mapRef.current;if(!map||!props.boundaries||!props.municipalities)return;
    provinceLayer.current?.remove();municipalLayer.current?.remove();
    provinceLayer.current=L.geoJSON(props.boundaries,{style:{color:'#b9eddf',weight:2,fillOpacity:0,interactive:false}}).addTo(map);
    municipalLayer.current=L.geoJSON(props.municipalities,{pane:'municipalities',style:{color:'#ffffff',weight:1,dashArray:'5 5',fillOpacity:0},onEachFeature(feature,layer){const element=document.createElement('span');element.textContent=feature.properties.shapeName;layer.bindTooltip(element,{sticky:true});}});
    if(props.visible.boundaries)municipalLayer.current.addTo(map);
    map.fitBounds(provinceLayer.current.getBounds(),{padding:[15,15]});
    map.setMaxBounds(provinceLayer.current.getBounds().pad(.14));
  },[props.boundaries,props.municipalities]);

  useEffect(()=>{const map=mapRef.current,layer=municipalLayer.current;if(!map||!layer)return;if(props.visible.boundaries)layer.addTo(map);else layer.remove();},[props.visible.boundaries]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    if(!props.municipality){if(provinceLayer.current)map.fitBounds(provinceLayer.current.getBounds(),{padding:[15,15]});return;}
    const feature=props.municipalities?.features.find(f=>f.properties.shapeName===props.municipality);
    if(feature)map.fitBounds(L.geoJSON(feature).getBounds(),{padding:[30,30]});
  },[props.municipality,props.municipalities]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    editing.current?.editing.disable();editing.current=null;group.current?.remove();
    const display=props.records.filter(r=>props.visible[r.properties.kind]&&(!props.municipality||r.properties.municipality===props.municipality));
    // Parcels render after filled overlays so selection stays accessible.
    display.sort((a,b)=>Number(a.properties.kind==='parcel')-Number(b.properties.kind==='parcel'));
    group.current=L.geoJSON(display,{pane:'records',style(feature){const p=feature!.properties;const selected=p.id===props.selectedId;return {color:p.kind==='parcel'?'#f4e368':selected?'#ffffff':COLORS[p.category]||'#62cdb7',weight:selected?3:p.kind==='parcel'?2:1.5,fillColor:COLORS[p.category]||'#78cabc',fillOpacity:p.kind==='parcel'?(selected?.08:0):props.opacity,dashArray:p.demo?'6 4':undefined};},onEachFeature(feature,layer){
      const label=document.createElement('span');label.textContent=`${feature.properties.name}${feature.properties.demo?' · DEMO':''}`;layer.bindTooltip(label,{sticky:true});layer.on('click',(event)=>{L.DomEvent.stopPropagation(event);callbacks.current.onSelect(feature.properties.id)});
      if(feature.properties.id===props.editId && layer instanceof L.Polygon){const editable=layer as EditablePolygon;editing.current=editable;editable.editing.enable();}
    }}).addTo(map);
  },[props.records,props.selectedId,props.visible,props.opacity,props.municipality,props.editId]);

  useEffect(()=>{
    const host=popupHost.current;if(!host)return;
    host.replaceChildren();
    const selected=props.records.find(r=>r.properties.id===props.selectedId);
    if(!selected||!props.showPopup||props.drawKind||props.editId||!props.visible[selected.properties.kind])return;
    const p=selected.properties,content=document.createElement('div');content.className='parcel-popup-content';
    const close=document.createElement('button');close.type='button';close.className='popup-close';close.setAttribute('aria-label','Close popup');close.textContent='×';close.addEventListener('click',()=>callbacks.current.onClosePopup());content.append(close);
    const badge=document.createElement('small');badge.className='popup-badge';badge.textContent=p.demo?'SYNTHETIC DEMO':p.kind==='zone'?'DRAFT ZONE':p.kind.toUpperCase();content.append(badge);
    const title=document.createElement('h2');title.textContent=p.name;content.append(title);
    const list=document.createElement('dl');content.append(list);
    const row=(label:string,value:string)=>{const item=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;item.append(term,description);list.append(item);};
    row('Lot / reference',p.reference||'Not recorded');row('Municipality',p.municipality||'Not recorded');row('Barangay',p.barangay||'Not recorded');row('Recorded use',p.category);row('Area estimate',formatArea(area(selected)));
    if(p.kind==='parcel'){
      try{const result=analyzeParcel(selected,props.records);row('Draft zone overlaps',result.zones.length?result.zones.map(z=>`${z.category} (${z.percent.toFixed(1)}%)`).join(' · '):'No available zoning data');row('Mapped hazards',result.hazards.length?result.hazards.map(h=>`${h.category} (${h.percent.toFixed(1)}%)`).join(' · '):'Coverage unknown');row('Remarks',result.finding);}catch{row('Analysis','Unavailable; inspect the record.');}
    }
    row('Source',p.source);row('Status',p.verification.replaceAll('_',' '));
    const action=document.createElement('button');action.type='button';action.className='popup-inspect';action.textContent='Inspect / review this record';action.addEventListener('click',()=>callbacks.current.onInspect());content.append(action);
    const note=document.createElement('p');note.className='popup-note';note.textContent=p.demo?'Demo geometry only. These are not real parcel boundaries.':'Drawn boundaries and zones are drafts until verified.';content.append(note);
    host.append(content);
    return ()=>host.replaceChildren();
  },[props.records,props.selectedId,props.showPopup,props.drawKind,props.editId,props.visible,props.mapMode]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    drawer.current?.disable();drawer.current=null;
    setCornerCount(0);
    // Leaflet.draw 1.0.4's readableArea assigns an undeclared variable in strict mode.
    // Keep its live-area tooltip off; Turf calculates the saved geometry's area.
    if(props.drawKind){drawer.current=new L.Draw.Polygon(map,{allowIntersection:false,showArea:false,shapeOptions:{color:'#f4e368',weight:2},drawError:{color:'#e45f5f',message:'Polygon edges cannot cross.'}});drawer.current.enable();}
    return ()=>{drawer.current?.disable();};
  },[props.drawKind]);

  return <section className={`map-region ${props.drawKind?'drawing':''}`} aria-label="Aklan satellite map">
    {/* Keep this className constant: Leaflet adds essential container classes itself. */}
    <div ref={container} className="map-canvas" />
    <div className="map-caption"><span className="map-caption-icon"><Layers3 size={15}/></span><div><strong>{imageryState}</strong><span>Administrative boundaries · 2020 reference</span></div></div>
    <div className="map-actions"><button title="Fit all Aklan" aria-label="Fit all Aklan" onClick={()=>provinceLayer.current&&mapRef.current?.fitBounds(provinceLayer.current.getBounds(),{padding:[20,20]})}><Expand size={19}/></button><button title="Zoom to selected record" aria-label="Zoom to selected record" disabled={!props.selectedId} onClick={()=>{const selected=props.records.find(r=>r.properties.id===props.selectedId);if(selected)mapRef.current?.fitBounds(L.geoJSON(selected).getBounds(),{padding:[60,60],maxZoom:18})}}><Crosshair size={19}/></button></div>
    <div className="map-coordinate"><MousePointer2 size={13}/>{coords}</div>
    {props.showPopup&&props.selectedId&&!props.drawKind&&!props.editId&&props.records.some(r=>r.properties.id===props.selectedId&&props.visible[r.properties.kind])&&<div ref={popupHost} className="map-record-popup" aria-label="Selected record popup"/>}
    {props.drawKind&&<div className="draw-instruction"><span role="status"><strong>{cornerCount} corners</strong> · Keep clicking to add more.</span><span>Finish when your boundary is complete (at least 3 corners).</span><div className="map-edit-actions"><button type="button" disabled={cornerCount<3} onClick={()=>drawer.current?.completeShape()}><Check size={16}/>Finish boundary</button><button type="button" disabled={!cornerCount} onClick={()=>drawer.current?.deleteLastVertex()}><Undo2 size={16}/>Undo last point</button><button type="button" onClick={props.onCancel}><X size={16}/>Cancel drawing <kbd>Esc</kbd></button></div></div>}
    {props.editId&&<div className="draw-instruction" role="status"><span>Drag the boundary handles to adjust the shape.</span><div className="map-edit-actions"><button type="button" onClick={props.onSaveBoundary}><Check size={16}/>Save boundary</button><button type="button" onClick={props.onCancel}><X size={16}/>Cancel editing <kbd>Esc</kbd></button></div></div>}
  </section>;
});
export default MapView;
