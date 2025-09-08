import { PERFORMANCE } from '@/constants/ui';

// Global text measurement cache for performance optimization
const textMeasureCache = new Map<string, number>();

// Global canvas for fast text measurements
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

const initMeasureCanvas = (): void => {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureContext = measureCanvas.getContext('2d');
  }
};

export const measureText = (text: string, fontSize: number): number => {
  // Cache hit - avoid any DOM measurement
  const cacheKey = `${text}-${fontSize}`;
  const cachedWidth = textMeasureCache.get(cacheKey);
  if (cachedWidth !== undefined) {
    return cachedWidth;
  }
  
  // Initialize canvas if necessary
  initMeasureCanvas();
  
  if (!measureContext) {
    // Fallback if canvas fails
    return text.length * fontSize * 0.6;
  }
  
  // Configure context to match SVG style
  measureContext.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  
  // Fast measurement via Canvas
  const metrics = measureContext.measureText(text);
  const width = metrics.width;
  
  // Cache for future use
  textMeasureCache.set(cacheKey, width);
  
  // Clean cache if it becomes too large (prevent memory leak)
  if (textMeasureCache.size > PERFORMANCE.TEXT_CACHE_MAX_SIZE) {
    const firstKey = textMeasureCache.keys().next().value;
    if (firstKey) {
      textMeasureCache.delete(firstKey);
    }
  }
  
  return width;
};

