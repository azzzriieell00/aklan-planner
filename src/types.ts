import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type Kind = 'parcel' | 'zone' | 'hazard' | 'observation';
export type PolygonGeometry = Polygon | MultiPolygon;
export type GeometryFeature = Feature<PolygonGeometry>;
export interface RecordProperties {
  id: string;
  kind: Kind;
  name: string;
  municipality: string;
  barangay: string;
  reference: string;
  category: string;
  source: string;
  sourceDate: string;
  verification: 'draft' | 'field_observed' | 'source_record';
  notes: string;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}
export type GISRecord = Feature<PolygonGeometry, RecordProperties>;
export interface Review {
  id: string;
  parcelId: string;
  parcelName: string;
  recordSnapshot: GISRecord;
  datasetSnapshot: GISRecord[];
  note: string;
  author: string;
  status: 'draft' | 'reviewed';
  createdAt: string;
  finding: string;
  analysis: Analysis;
}
export interface Workspace {
  version: 1;
  records: GISRecord[];
  reviews: Review[];
}
export interface BoundaryProperties { shapeName: string; shapeID: string; source: string; reference_year: number }
export type Boundaries = FeatureCollection<PolygonGeometry, BoundaryProperties>;
export interface Overlap { name: string; category: string; percent: number; area: number; source: string; demo: boolean }
export interface Analysis {
  area: number;
  zones: Overlap[];
  hazards: Overlap[];
  zoneCoverage: number;
  conflictingZones: boolean;
  finding: string;
  warnings: string[];
}
