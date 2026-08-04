// Canvas Data Models
// Defines types and interfaces for the Interactive Canvas feature

/**
 * Point in 2D space (canvas coordinates)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Viewport transformation for pan and zoom
 */
export interface ViewportTransform {
  x: number;      // Pan offset X
  y: number;      // Pan offset Y
  scale: number;  // Zoom level (1.0 = 100%)
}

/**
 * Canvas document metadata
 */
export interface CanvasDocument {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  thumbnail: string | null;  // Base64 preview image
  created_at: string;
  updated_at: string;
}

/**
 * Available canvas drawing tools
 */
export type CanvasTool = 
  | 'hand'
  | 'pen'
  | 'pencil'
  | 'eraser'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'arrow'
  | 'line'
  | 'text'
  | 'select';

/**
 * Canvas element types (discriminator for union type)
 */
export type CanvasElementType = 
  | 'stroke'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'arrow'
  | 'line'
  | 'text';

/**
 * Base properties shared by all canvas elements
 */
export interface BaseCanvasElement {
  id: string;
  canvas_id: string;
  type: CanvasElementType;
  position: Point;
  color: string;
  strokeWidth: number;
  created_at: string;
  updated_at: string;
}

/**
 * Freehand stroke element (pen or pencil)
 */
export interface StrokeElement extends BaseCanvasElement {
  type: 'stroke';
  points: Point[];  // Array of points for freehand drawing
  tool: 'pen' | 'pencil';
}

/**
 * Rectangle shape element
 */
export interface RectangleElement extends BaseCanvasElement {
  type: 'rectangle';
  width: number;
  height: number;
  filled: boolean;
}

/**
 * Circle shape element
 */
export interface CircleElement extends BaseCanvasElement {
  type: 'circle';
  radius: number;
  filled: boolean;
}

/**
 * Triangle shape element
 */
export interface TriangleElement extends BaseCanvasElement {
  type: 'triangle';
  width: number;
  height: number;
  filled: boolean;
}

/**
 * Arrow element (line with arrowhead)
 */
export interface ArrowElement extends BaseCanvasElement {
  type: 'arrow';
  endPoint: Point;
  headSize: number;
}

/**
 * Straight line element
 */
export interface LineElement extends BaseCanvasElement {
  type: 'line';
  endPoint: Point;
}

/**
 * Text element
 */
export interface TextElement extends BaseCanvasElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
}

/**
 * Discriminated union of all canvas element types
 */
export type CanvasElement = 
  | StrokeElement
  | RectangleElement
  | CircleElement
  | TriangleElement
  | ArrowElement
  | LineElement
  | TextElement;

/**
 * Canvas color palette from Athenaeum design system
 */
export const CANVAS_COLORS = [
  '#9c4a26', // terracotta-600
  '#5a7a50', // sage-500
  '#c8973f', // gold-400
  '#a23f34', // brick-500
  '#221f1c', // ink-700
  '#4a443f', // ink-500
  '#968b7d', // warmgray-400
  '#ffffff', // white
] as const;

/**
 * Type for canvas colors (literal union)
 */
export type CanvasColor = typeof CANVAS_COLORS[number];
