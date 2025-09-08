import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Hexagon } from './Hexagon';
import { MetricPoint } from '@/types/polystat';
import { COLORS } from '@/constants/ui';

interface HexGridProps {
  data: MetricPoint[];
  width: number;
  height: number;
  hexSize?: 'small' | 'medium' | 'large' | 'auto';
  onHexClick?: (hex: MetricPoint) => void;
  onLabelClick?: (labelKey: string, labelValue: string) => void;
  hiddenLabelKey?: string; // Label key to hide in hexagons
  initialZoom?: number; // Initial zoom level
  isGrouped?: boolean; // Indicates grouped mode
}

interface HexCoord {
  q: number;
  r: number;
  x: number;
  y: number;
  data: MetricPoint;
}

export const HexGrid: React.FC<HexGridProps> = ({
  data,
  width,
  height,
  hexSize = 'auto',
  onHexClick,
  onLabelClick,
  hiddenLabelKey,
  initialZoom = 1,
  isGrouped = false,
}) => {
  // Validate props to prevent rendering errors
  if (typeof width !== 'number' || isNaN(width) || width <= 0) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#dc2626'}}>
        <p>Error: Invalid dimensions (width: {width})</p>
      </div>
    );
  }
  
  if (typeof height !== 'number' || isNaN(height) || height <= 0) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#dc2626'}}>
        <p>Error: Invalid dimensions (height: {height})</p>
      </div>
    );
  }

  // Validate reasonable maximum dimensions
  const maxDimension = 5000;
  if (width > maxDimension || height > maxDimension) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#dc2626'}}>
        <p>Error: Dimensions too large ({width}x{height})</p>
      </div>
    );
  }

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Initialize zoom with initialZoom if provided, otherwise use 1
  const [zoom, setZoom] = useState(() => {
    // Calculate initial zoom immediately to avoid double refresh
    if (initialZoom !== undefined) {
      return initialZoom;
    }
    return 1;
  });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pendingGroupCenters, setPendingGroupCenters] = useState<Array<{groupId: string, realCenterX: number, realCenterY: number}>>([]);
  const [isRecentering, setIsRecentering] = useState(false);
  
  const prevGroupSignatureRef = useRef('');

  // Direct color calculation without usePolyStat

  // Calculate hexagon size
  const hexSizeValue = useMemo(() => {
    if (hexSize === 'auto') {
      const count = data.length;
      if (count === 0) return 20;
      
      // Validate dimensions to avoid NaN
      const validWidth = typeof width === 'number' && !isNaN(width) && width > 0 ? width : 800;
      const validHeight = typeof height === 'number' && !isNaN(height) && height > 0 ? height : 600;
      
      // Auto-calculate based on data count and container size
      const cols = Math.ceil(Math.sqrt(count * (validWidth / validHeight)));
      const rows = Math.ceil(count / cols);
      
      const hexWidth = validWidth / (cols + 0.5);
      const hexHeight = validHeight / (rows * 0.866);
      const calculatedSize = Math.min(hexWidth, hexHeight) / 2;
      
      // Validate calculation result
      if (isNaN(calculatedSize) || calculatedSize <= 0) {
        return 20;
      }
      
      // Apply reasonable limits for grouped mode
      const hasGroupOffsets = data.some(item => item.groupOffset);
      if (hasGroupOffsets && calculatedSize > 100) {
        return 100;
      }
      
      return calculatedSize;
    }
    
    const sizeMap = {
      small: 15,
      medium: 25,
      large: 35,
    };
    
    return sizeMap[hexSize];
  }, [hexSize, data.length, width, height]);

  // Calculate adaptive zoom limits based on actual hexagon size
  const zoomLimits = useMemo(() => {
    // Validate dimensions to avoid NaN
    const validWidth = typeof width === 'number' && !isNaN(width) && width > 0 ? width : 800;
    const validHeight = typeof height === 'number' && !isNaN(height) && height > 0 ? height : 600;
    
    // Hexagon size in viewport (pixels)
    const hexagonScreenSize = hexSizeValue;
    
    // MIN ZOOM: Hexagon still visible as geometric shape
    // Minimum 6 pixels radius to be recognizable
    const minVisibleHexRadius = 6; // minimum pixels to see shape
    const minZoom = minVisibleHexRadius / hexagonScreenSize;
    
    // MAX ZOOM: Hexagon fills 80% of smallest window dimension
    // Allows comfortable text reading
    const maxHexRadiusScreen = Math.min(validWidth, validHeight) * 0.4; // 80% / 2 = 40% radius
    const maxZoom = maxHexRadiusScreen / hexagonScreenSize;
    
    // Validation and safety limits
    const safeMinZoom = Math.max(0.01, Math.min(minZoom, 1)); // Never go below 0.01
    const safeMaxZoom = Math.max(safeMinZoom * 2, Math.min(maxZoom, 50)); // Never exceed 50x
    
    const result = {
      min: safeMinZoom,
      max: safeMaxZoom,
      // Adaptive starting zoom: begin at size where hexagons are clearly visible
      initial: Math.min(1, safeMaxZoom * 0.3) // 30% of max zoom, capped at 1
    };
    
    return result;
  }, [hexSizeValue, width, height]);

  // Auto-calculate colors (green, orange, red) based on values
  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    
    // Filter normal metrics (exclude summary hexagons)
    const normalMetrics = data.filter(item => item.labels?.type !== 'summary');
    
    if (normalMetrics.length === 0) return data; // If only summary, return as-is
    
    const values = normalMetrics.map(item => item.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    
    return data.map(item => {
      // Keep original color for summary hexagons
      if (item.labels?.type === 'summary') {
        return {
          ...item,
          thresholdLevel: 'normal' as const,
          color: item.color || '#6B7280', // Default gray color
        };
      }
      
      let color: string = COLORS.NORMAL; // Default green
      let level: 'normal' | 'warning' | 'critical' = 'normal';
      
      if (range > 0) {
        const ratio = (item.value - minVal) / range;
        
        if (ratio >= 0.66) {
          color = COLORS.CRITICAL; // Red
          level = 'critical';
        } else if (ratio >= 0.33) {
          color = COLORS.WARNING; // Orange
          level = 'warning';
        } else {
          color = COLORS.NORMAL; // Green
          level = 'normal';
        }
      }
      
      return {
        ...item,
        thresholdLevel: level,
        color: color,
      };
    });
  }, [data]);

  // Helper function to calculate hexagonal coordinates
  const calculateHexCoords = useCallback((sortedData: MetricPoint[], containerWidth: number, containerHeight: number, size: number): HexCoord[] => {
    // Validate dimensions to avoid NaN
    const validWidth = typeof containerWidth === 'number' && !isNaN(containerWidth) && containerWidth > 0 ? containerWidth : 800;
    const validHeight = typeof containerHeight === 'number' && !isNaN(containerHeight) && containerHeight > 0 ? containerHeight : 600;
    
    // Validate reasonable maximum dimensions
    const maxDimension = 5000;
    if (validWidth > maxDimension || validHeight > maxDimension) {
      return [];
    }
    
    const count = sortedData.length;
    
    // Exact dimensions of a pointed hexagon (point upward)
    const hexWidth = size * Math.sqrt(3); // Width of pointed hexagon
    const hexHeight = size * 2;           // Height of pointed hexagon
    
    // Calculate optimal column and row count for placement
    const aspectRatio = validWidth / validHeight;
    const cols = Math.ceil(Math.sqrt(count * aspectRatio));
    const rows = Math.ceil(count / cols);
    
    // Spacing for honeycomb pattern
    const horizontalSpacing = hexWidth;                    // No horizontal overlap
    const verticalSpacing = hexHeight * 0.75;             // Reduced vertical spacing for honeycomb
    const rowOffset = hexWidth / 2;                       // Horizontal offset for odd rows
    
    // For groups, no exclusion for input field
    const inputFieldHeight = 0; // No reserved space in groups
    const availableHeight = validHeight - inputFieldHeight;
    
    // Center the grid
    const totalWidth = (cols - 1) * horizontalSpacing + rowOffset;
    const totalHeight = (rows - 1) * verticalSpacing;
    const startX = (validWidth - totalWidth) / 2;
    const startY = inputFieldHeight + (availableHeight - totalHeight) / 2;
    
    const result = sortedData.map((item: MetricPoint, index: number) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Staggered offset for odd rows (honeycomb pattern)
      const hexOffsetX = row % 2 === 1 ? rowOffset : 0;
      
      const x = startX + col * horizontalSpacing + hexOffsetX;
      const y = startY + row * verticalSpacing;
      
      // Validate calculated coordinates
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
        return {
          q: col,
          r: row,
          x: 0,
          y: 0,
          data: item,
        };
      }
      
      return {
        q: col,
        r: row,
        x: x,
        y: y,
        data: item,
      };
    });
    
    return result;
  }, []);

  // Function to emit transformation changes
  const emitTransformUpdate = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    const event = new CustomEvent('hexgrid-transform', {
      detail: { zoom: newZoom, pan: newPan, isRecentering }
    });
    window.dispatchEvent(event);
  }, [isRecentering]);

  // Function to emit group centering info with hexagon size
  const emitGroupCenters = useCallback((groupCenters: Array<{groupId: string, realCenterX: number, realCenterY: number}>) => {
    const event = new CustomEvent('hexgrid-group-centers', {
      detail: { groupCenters, hexSize: hexSizeValue }
    });
    window.dispatchEvent(event);
  }, [hexSizeValue]);

  // Generate hexagonal coordinates with optimal nesting
  const hexCoords: HexCoord[] = useMemo(() => {
    if (processedData.length === 0) {
      return [];
    }
    
    // Check if we have grouped data with offsets
    const hasGroupOffsets = processedData.some(item => item.groupOffset);
    
    // Only start recentering if we're SWITCHING TO grouped mode (not if already in grouped mode)
    const currentGroupIds = hasGroupOffsets ? 
      [...new Set(processedData.map(item => item.groupId).filter(Boolean))] : [];
    
    const groupSignature = currentGroupIds.sort().join('|');
    const isNewGrouping = groupSignature !== prevGroupSignatureRef.current && groupSignature !== '';
    
    if (hasGroupOffsets && isNewGrouping) {
      setIsRecentering(true);
    }
    
    
    if (hasGroupOffsets) {
      // Grouped mode: process each group separately
      const groupedItems = new Map();
      
      processedData.forEach((item) => {
        const key = `${item.groupOffset?.x || 0}-${item.groupOffset?.y || 0}`;
        if (!groupedItems.has(key)) {
          groupedItems.set(key, []);
        }
        groupedItems.get(key).push(item);
      });
      
      const allCoords: HexCoord[] = [];
      const groupCenters: Array<{groupId: string, realCenterX: number, realCenterY: number}> = [];
      
      groupedItems.forEach((items) => {
        if (items.length === 0) return;
        
        const groupOffset = items[0].groupOffset;
        const groupArea = items[0].groupArea;
        const groupId = items[0].groupId;
        const sortedItems = [...items].sort((a, b) => b.value - a.value);
        
        // Calculate positions for this group
        const groupCoords = calculateHexCoords(sortedItems, groupArea.width, groupArea.height, hexSizeValue);
        
        // Calculate real center and top edge of hexagons in this group
        if (groupCoords.length > 0 && groupId) {
          // First apply group offset to coordinates to get real positions
          const realCoords = groupCoords.map(coord => ({
            x: coord.x + groupOffset.x,
            y: coord.y + groupOffset.y
          }));
          
          const minX = Math.min(...realCoords.map(c => c.x));
          const maxX = Math.max(...realCoords.map(c => c.x));
          const minY = Math.min(...realCoords.map(c => c.y));
          // const maxY = Math.max(...realCoords.map(c => c.y));
          
          const realCenterX = (minX + maxX) / 2;
          // For header, use top edge of group (minY - hexSize)
          const realTopY = minY - hexSizeValue;
          
          groupCenters.push({
            groupId,
            realCenterX,
            realCenterY: realTopY // Position for header above hexagons
          });
        }
        
        // Apply group offset
        groupCoords.forEach((coord: HexCoord) => {
          coord.x += groupOffset.x;
          coord.y += groupOffset.y;
          allCoords.push(coord);
        });
      });
      
      // Store centers for later emission after recentering
      setPendingGroupCenters(groupCenters);
      
      return allCoords;
    } else {
      // Normal mode - clear group centers
      setPendingGroupCenters([]);
      const sortedData = [...processedData].sort((a, b) => b.value - a.value);
      return calculateHexCoords(sortedData, width, height, hexSizeValue);
    }
  }, [processedData, width, height, hexSizeValue, calculateHexCoords, emitGroupCenters]);

  // Handle zoom with mouse-position zoom and adaptive limits
  const handleZoom = useCallback((delta: number, event?: WheelEvent) => {
    if (event && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Calculate new states synchronously
      const currentZoom = zoom;
      const currentPan = pan;
      
      // Use adaptive limits instead of fixed values - increased speed for quick navigation
      const zoomSpeed = 0.3; // Fine speed to not skip levels
      const newZoom = currentZoom + delta * zoomSpeed;
      let clampedZoom = Math.max(zoomLimits.min, Math.min(zoomLimits.max, newZoom));
      
      // FIX: Limit max zoom to 6 in all modes
      if (clampedZoom > 6) {
        clampedZoom = 6;
      }
      
      
      // Validate zoom
      if (isNaN(clampedZoom) || !isFinite(clampedZoom)) {
        return;
      }
      
      // Convert mouse position to world coordinates BEFORE zoom
      const worldX = (mouseX - currentPan.x) / currentZoom;
      const worldY = (mouseY - currentPan.y) / currentZoom;
      
      // FIX: Calculate new pan with protection against extreme values
      let newPan = {
        x: mouseX - worldX * clampedZoom,
        y: mouseY - worldY * clampedZoom
      };
      
      // FIX: Protection against NaN/Infinity values but no zoom limitation
      // Zoom must stay mouse-centered, so don't limit pan changes here
      if (!isFinite(newPan.x) || !isFinite(newPan.y) || isNaN(newPan.x) || isNaN(newPan.y)) {
        newPan = currentPan;
      }
      
      
      // Update states
      setZoom(clampedZoom);
      setPan(newPan);
      
      // Emit transformation event
      emitTransformUpdate(clampedZoom, newPan);
    } else {
      // Simple zoom without event (fallback)
      setZoom(prev => {
        const zoomSpeed = 0.3; // Same speed as zoom with event
        const newZoom = prev + delta * zoomSpeed;
        let clampedZoom = Math.max(zoomLimits.min, Math.min(zoomLimits.max, newZoom));
        
        // Apply same limit of 6
        if (clampedZoom > 6) {
          clampedZoom = 6;
        }
        
        emitTransformUpdate(clampedZoom, pan);
        return clampedZoom;
      });
    }
  }, [zoom, pan, zoomLimits, emitTransformUpdate, isGrouped, hexCoords.length]);

  // Function to recenter grid with adaptive zoom for ALL hexagons
  const recenterGrid = useCallback(() => {
    if (hexCoords.length === 0) {
      const newPan = { x: 0, y: 0 };
      const newZoom = zoomLimits.initial;
      setPan(newPan);
      setZoom(newZoom);
      emitTransformUpdate(newZoom, newPan);
      setIsRecentering(false);
      return;
    }

    // Calculate bounds of all hexagons
    const allX = hexCoords.map(coord => coord.x);
    const allY = hexCoords.map(coord => coord.y);
    const minX = Math.min(...allX) - hexSizeValue;
    const maxX = Math.max(...allX) + hexSizeValue;
    const minY = Math.min(...allY) - hexSizeValue;
    const maxY = Math.max(...allY) + hexSizeValue;
    
    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;
    
    // Calculate zoom needed to show everything with margin
    // Use larger margins for grouped mode to account for App.tsx horizontal margins
    const isGroupedMode = hexCoords.some(coord => coord.data.groupOffset);
    const horizontalMargin = isGroupedMode ? 0.2 : 0.1; // 20% for grouped, 10% for normal
    
    // For grouped mode, calculate vertical margin based on actual UI elements space
    let verticalMargin = 0.1; // Default 10% margin for normal mode
    
    if (isGroupedMode) {
      // In grouped mode, we need to account for the UI elements at the top
      // Calculate similar to App.tsx logic but more conservative
      let uiElementsHeight = 80; // Base: PromQL input + top margin
      
      // Add height for labels area (estimated based on common cases)
      uiElementsHeight += 40; // Labels row height
      
      // Add moderate space for potential expanded labels and filters
      uiElementsHeight += 40; // Reduced buffer for expanded state and filters
      
      // Add floating header buffer (reduced)
      const floatingHeaderBuffer = 80; // Reduced from 120 to 80
      const totalReservedHeight = uiElementsHeight + floatingHeaderBuffer;
      
      // Convert reserved height to a margin ratio
      const reservedRatio = totalReservedHeight / height;
      verticalMargin = Math.max(0.1, reservedRatio); // At least 10% margin
    }
    
    const zoomX = (width * (1 - horizontalMargin)) / gridWidth;
    const zoomY = (height * (1 - verticalMargin)) / gridHeight;
    const optimalZoom = Math.min(zoomX, zoomY);
    
    // Limit zoom to defined bounds
    const clampedZoom = Math.max(zoomLimits.min, Math.min(zoomLimits.max, optimalZoom));
    
    // Calculate pan to position grid, accounting for reserved space
    let targetX, targetY;
    
    if (isGroupedMode) {
      // For grouped mode, ensure top-left area (most important clusters) is always visible
      // But try to center when there's enough space
      
      // Calculate reserved height for UI elements
      let uiElementsHeight = 60; // Base: PromQL input + top margin (reduced)
      uiElementsHeight += 30; // Labels row height (reduced)
      uiElementsHeight += 20; // Buffer for expanded state and filters (reduced)
      const floatingHeaderBuffer = 40; // Reduced from 80
      const totalReservedHeight = uiElementsHeight + floatingHeaderBuffer;
      
      // Calculate available viewport space
      const availableWidth = width;
      const availableHeight = height - totalReservedHeight;
      
      // Calculate grid dimensions at current zoom
      const gridWidthZoomed = gridWidth * clampedZoom;
      const gridHeightZoomed = gridHeight * clampedZoom;
      
      // Check if we have enough space to center
      const hasSpaceX = gridWidthZoomed < availableWidth;
      const hasSpaceY = gridHeightZoomed < availableHeight;
      
      if (hasSpaceX && hasSpaceY) {
        // Center when there's enough space
        const gridCenterX = (minX + maxX) / 2;
        const gridCenterY = (minY + maxY) / 2;
        const viewportCenterX = width / 2;
        const viewportCenterY = totalReservedHeight + (availableHeight / 2);
        
        targetX = viewportCenterX - gridCenterX * clampedZoom;
        targetY = viewportCenterY - gridCenterY * clampedZoom;
      } else {
        // Not enough space: prioritize top-left visibility
        const marginX = hexSizeValue * 2; // Small margin from left edge
        const marginY = totalReservedHeight + hexSizeValue; // Small margin from UI elements
        
        // If we have horizontal space, center horizontally
        if (hasSpaceX) {
          const gridCenterX = (minX + maxX) / 2;
          const viewportCenterX = width / 2;
          targetX = viewportCenterX - gridCenterX * clampedZoom;
        } else {
          targetX = marginX - minX * clampedZoom;
        }
        
        // If we have vertical space, center vertically
        if (hasSpaceY) {
          const gridCenterY = (minY + maxY) / 2;
          const viewportCenterY = totalReservedHeight + (availableHeight / 2);
          targetY = viewportCenterY - gridCenterY * clampedZoom;
        } else {
          targetY = marginY - minY * clampedZoom;
        }
      }
    } else {
      // Normal mode: center on all hexagons
      const gridCenterX = (minX + maxX) / 2;
      const gridCenterY = (minY + maxY) / 2;
      const viewportCenterX = width / 2;
      const viewportCenterY = height / 2;
      
      targetX = viewportCenterX - gridCenterX * clampedZoom;
      targetY = viewportCenterY - gridCenterY * clampedZoom;
    }
    
    // No additional vertical adjustment needed since it's already calculated above
    
    const newPan = {
      x: targetX,
      y: targetY
    };
    
    setPan(newPan);
    setZoom(clampedZoom);
    emitTransformUpdate(clampedZoom, newPan);
    
    // Simplified: Let the useEffect safety timeout handle isRecentering reset
    // Just emit group centers
    setTimeout(() => {
      if (pendingGroupCenters.length > 0) {
        emitGroupCenters(pendingGroupCenters);
      }
    }, 100);
    
    // Emit a separate transform update after state change to notify with isRecentering = false
    setTimeout(() => {
      const event = new CustomEvent('hexgrid-transform', {
        detail: { zoom: clampedZoom, pan: newPan, isRecentering: false }
      });
      window.dispatchEvent(event);
    }, 60);
  }, [hexCoords, hexSizeValue, width, height, zoomLimits, emitTransformUpdate, pendingGroupCenters, emitGroupCenters]);

  // Handle double-click to recenter
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    recenterGrid();
  }, [recenterGrid]);

  // Handle pan
  const handlePanStart = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    const startX = event.clientX - pan.x;
    const startY = event.clientY - pan.y;
    
    
    // Validate starting values
    if (isNaN(startX) || isNaN(startY)) {
      setDragStart({ x: 0, y: 0 });
      setPan({ x: 0, y: 0 });
    } else {
      setDragStart({ x: startX, y: startY });
    }
  }, [pan, isGrouped, zoom, hexCoords]);


  // State to track if mouse is over container
  const [isMouseOverContainer, setIsMouseOverContainer] = useState(false);

  // Virtualization: only render hexagons visible in viewport for large datasets
  const visibleHexCoords = useMemo(() => {
    // Only apply virtualization for large datasets (> 1000 hexagons)
    if (hexCoords.length <= 1000) {
      return hexCoords;
    }

    // Calculate viewport bounds in world coordinates
    const viewportLeft = -pan.x / zoom;
    const viewportRight = (-pan.x + width) / zoom;
    const viewportTop = -pan.y / zoom;
    const viewportBottom = (-pan.y + height) / zoom;

    // Add padding to include hexagons that might be partially visible
    const padding = hexSizeValue * 2;

    return hexCoords.filter(coord => {
      return coord.x + padding >= viewportLeft &&
             coord.x - padding <= viewportRight &&
             coord.y + padding >= viewportTop &&
             coord.y - padding <= viewportBottom;
    });
  }, [hexCoords, pan.x, pan.y, zoom, width, height, hexSizeValue]);

  // Track global mouse position to maintain state after re-render
  useEffect(() => {
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isInside = 
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        
        setIsMouseOverContainer(isInside);
      }
    };

    const checkInitialPosition = () => {
      if (containerRef.current && lastMouseX > 0 && lastMouseY > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        const isInside = 
          lastMouseX >= rect.left &&
          lastMouseX <= rect.right &&
          lastMouseY >= rect.top &&
          lastMouseY <= rect.bottom;
        
        setIsMouseOverContainer(isInside);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    
    // Check initial position after small delay
    setTimeout(checkInitialPosition, 10);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [data]); // Re-check when data changes

  // Handle mouse events
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // Check if mouse is over container before processing zoom
      if (isMouseOverContainer) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -1 : 1;
        handleZoom(delta, event);
      }
    };

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        const newX = event.clientX - dragStart.x;
        const newY = event.clientY - dragStart.y;
        
        // const panDelta = {
        //   x: newX - pan.x,
        //   y: newY - pan.y
        // };
        
        
        // Validate new pan values
        if (!isNaN(newX) && !isNaN(newY) && isFinite(newX) && isFinite(newY)) {
          const newPan = { x: newX, y: newY };
          setPan(newPan);
          emitTransformUpdate(zoom, newPan);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    // Attach wheel event to window to avoid focus issues
    window.addEventListener('wheel', handleWheel, { passive: false });

    // Add global events for drag
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleZoom, isDragging, dragStart, setPan, zoom, emitTransformUpdate, isMouseOverContainer]);

  // Emit initial transformation state - but only if we're not in grouped mode
  useEffect(() => {
    // Don't emit initial state if we're in grouped mode - recenterGrid will handle it
    if (!processedData.some(item => item.groupOffset)) {
      emitTransformUpdate(zoom, pan);
    }
  }, []);

  // Apply initial adaptive zoom when initialZoom changes
  useEffect(() => {
    if (initialZoom !== undefined) {
      const clampedZoom = Math.max(zoomLimits.min, Math.min(zoomLimits.max, initialZoom));
      if (Math.abs(clampedZoom - zoom) > 0.01) { // Only if significant difference
        setZoom(clampedZoom);
        emitTransformUpdate(clampedZoom, pan);
      }
    }
  }, [initialZoom, zoomLimits]); // React to both initialZoom and limit changes

  // Emit group centers when they change (with delay to avoid flash)
  useEffect(() => {
    if (pendingGroupCenters.length > 0) {
      // Small delay to allow recentering to complete first
      const timer = setTimeout(() => {
        emitGroupCenters(pendingGroupCenters);
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [pendingGroupCenters, emitGroupCenters]);

  // FIX: Auto-recenter when hexagon coordinates change (grouping change)
  useEffect(() => {
    if (hexCoords.length > 0) {
      // Detect if we just changed grouping mode
      const hasGroupOffsets = hexCoords.some(coord => coord.data.groupOffset);
      const currentGroupIds = hasGroupOffsets ? 
        [...new Set(hexCoords.map(coord => coord.data.groupId).filter(Boolean))] : [];
      
      // Create signature of current groups to detect changes
      const groupSignature = currentGroupIds.sort().join('|');
      
      // If signature changed (new grouping), start recentering immediately  
      if (groupSignature !== prevGroupSignatureRef.current && groupSignature !== '') {
        // Start recentering state immediately to hide display
        setIsRecentering(true);
        // Immediate recenter without delay for smoother experience
        recenterGrid();
        
        // SIMPLIFIED: Single safety timeout
        setTimeout(() => {
          setIsRecentering(false);
        }, 300); // Shorter timeout
      }
      
      prevGroupSignatureRef.current = groupSignature;
    }
  }, [hexCoords, recenterGrid]);

  // No hover handling

  // Handle click
  const handleHexClick = useCallback((hex: MetricPoint) => {
    onHexClick?.(hex);
  }, [onHexClick]);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      onMouseEnter={() => setIsMouseOverContainer(true)}
      onMouseLeave={() => setIsMouseOverContainer(false)}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        outline: 'none' // Remove focus outline
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handlePanStart}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          {/* Filters for visual effects */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {!isRecentering && visibleHexCoords.map((coord, index) => (
            <Hexagon
              key={`${coord.data.name}-${index}`}
              x={coord.x}
              y={coord.y}
              size={hexSizeValue}
              data={coord.data}
              onClick={handleHexClick}
              onLabelClick={onLabelClick}
              zoom={zoom}
              hiddenLabelKey={hiddenLabelKey}
              zoomLimits={zoomLimits}
            />
          ))}
        </g>
      </svg>

      {/* Clean interface - no controls or legend */}
    </div>
  );
};
