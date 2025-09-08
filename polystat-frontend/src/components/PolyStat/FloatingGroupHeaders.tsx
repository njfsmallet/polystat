import React, { useEffect, useState, useRef, useMemo } from 'react';
import { GroupLabel } from '@/types/polystat';
import { useTheme } from '@/contexts/ThemeContext';

interface FloatingGroupHeadersProps {
  groupLabels: GroupLabel[];
  containerSize: { width: number; height: number };
  onGroupClick?: (groupValue: string) => void;
  selectedGroupValue?: string;
}

export const FloatingGroupHeaders: React.FC<FloatingGroupHeadersProps> = ({
  groupLabels,
  containerSize,
  onGroupClick,
  selectedGroupValue
}) => {
  const { colors } = useTheme();
  const [currentTransform, setCurrentTransform] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [realGroupCenters, setRealGroupCenters] = useState<Array<{groupId: string, realCenterX: number, realCenterY: number}>>([]);
  const [hexSize, setHexSize] = useState(25);
  const [hasReceivedTransform, setHasReceivedTransform] = useState(false);
  const [hasReceivedGroupCenters, setHasReceivedGroupCenters] = useState(false);
  const [isRecentering, setIsRecentering] = useState(false);
  
  // Simplified: Only initialize when we have received both transform AND group centers
  const isInitialized = hasReceivedTransform && hasReceivedGroupCenters;

  // Listen for SVG parent transformations
  useEffect(() => {
    const handleTransformUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setCurrentTransform({
        zoom: customEvent.detail.zoom,
        pan: customEvent.detail.pan
      });
      setIsRecentering(customEvent.detail.isRecentering || false);
      setHasReceivedTransform(true);
    };

    const handleGroupCenters = (event: Event) => {
      const customEvent = event as CustomEvent;
      setRealGroupCenters(customEvent.detail.groupCenters);
      if (customEvent.detail.hexSize) {
        setHexSize(customEvent.detail.hexSize);
      }
      setHasReceivedGroupCenters(true);
    };

    window.addEventListener('hexgrid-transform', handleTransformUpdate);
    window.addEventListener('hexgrid-group-centers', handleGroupCenters);

    return () => {
      window.removeEventListener('hexgrid-transform', handleTransformUpdate);
      window.removeEventListener('hexgrid-group-centers', handleGroupCenters);
    };
  }, []);

  // Reset initialization ONLY when group labels signature changes (not every time)
  const groupSignature = useMemo(() => {
    return groupLabels.map(label => label.groupId).sort().join('-');
  }, [groupLabels]);
  
  const prevGroupSignatureRef = useRef('');
  
  useEffect(() => {
    if (prevGroupSignatureRef.current !== '' && groupSignature !== prevGroupSignatureRef.current) {
      setHasReceivedTransform(false);
      setHasReceivedGroupCenters(false);
    }
    prevGroupSignatureRef.current = groupSignature;
  }, [groupSignature]);

  // Don't render until we have received group centers data or if recentering is in progress
  if ((!isInitialized && groupLabels.length > 0) || isRecentering) {
    return null;
  }

  // Calculate transformed header positions using real centers
  const transformedLabels = groupLabels.map(label => {
    // Find real center for this group by groupId
    const realCenter = realGroupCenters.find(center => center.groupId === label.groupId);
    
    let transformedX, transformedY;
    
    if (realCenter) {
      // Use real center calculated by HexGrid for X
      transformedX = realCenter.realCenterX * currentTransform.zoom + currentTransform.pan.x;
      // For Y, realCenterY already contains the upper edge position of hexagons
      // Adjust margin based on zoom to avoid overlap at low zoom
      const baseSafetyMargin = 40;
      // Lower zoom increases margin to compensate for density
      const zoomAdjustedMargin = baseSafetyMargin + (baseSafetyMargin * (1 / Math.max(currentTransform.zoom, 0.1) - 1) * 0.5);
      const headerOffset = zoomAdjustedMargin * currentTransform.zoom;
      transformedY = (realCenter.realCenterY * currentTransform.zoom + currentTransform.pan.y) - headerOffset;
      
      
    } else {
      // Fallback to old method with same security logic
      transformedX = label.groupX * currentTransform.zoom + currentTransform.pan.x;
      const baseSafetyMargin = 40;
      const zoomAdjustedMargin = baseSafetyMargin + (baseSafetyMargin * (1 / Math.max(currentTransform.zoom, 0.1) - 1) * 0.5);
      const headerOffset = (hexSize + zoomAdjustedMargin) * currentTransform.zoom;
      transformedY = (label.groupY * currentTransform.zoom + currentTransform.pan.y) - headerOffset;
    }
    
    // Normal header scale
    const headerScale = Math.max(0.8, Math.min(1.2, currentTransform.zoom));

    return {
      ...label,
      transformedX,
      transformedY,
      scale: headerScale,
      hasRealCenter: !!realCenter
    };
  });

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 10,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none'
    }}>
      {transformedLabels.map((label) => {
        // Check if header is visible in viewport
        const isVisible = 
          label.transformedX > -100 && 
          label.transformedX < containerSize.width + 100 &&
          label.transformedY > -50 && 
          label.transformedY < containerSize.height + 50;

        if (!isVisible) return null;

        const isSelected = selectedGroupValue === label.groupValue;

        return (
          <React.Fragment key={label.groupId}>
            <div
              style={{
                position: 'absolute',
                left: label.transformedX,
                top: label.transformedY,
                transform: `translate(-50%, 0) scale(${label.scale})`,
                transformOrigin: 'center top',
                textAlign: 'center',
                pointerEvents: onGroupClick ? 'auto' : 'none',
                backgroundColor: isSelected ? `${colors.accent}E6` : `${colors.surface}E6`,
                padding: '6px 10px',
                borderRadius: '6px',
                boxShadow: isSelected ? `0 2px 8px ${colors.accent}4D` : `0 1px 4px ${colors.background}66`,
                border: isSelected ? `1px solid ${colors.accent}CC` : `1px solid ${colors.border}99`,
                backdropFilter: 'blur(2px)',
                transition: 'all 0.15s ease-out',
                cursor: onGroupClick ? 'pointer' : 'default',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none'
              }}
              onClick={() => onGroupClick?.(label.groupValue)}
              onMouseEnter={(e) => {
                if (onGroupClick && !isSelected) {
                  e.currentTarget.style.backgroundColor = `${colors.accent}1A`;
                  e.currentTarget.style.borderColor = `${colors.accent}99`;
                  e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}33`;
                }
              }}
              onMouseLeave={(e) => {
                if (onGroupClick && !isSelected) {
                  e.currentTarget.style.backgroundColor = `${colors.surface}E6`;
                  e.currentTarget.style.borderColor = `${colors.border}99`;
                  e.currentTarget.style.boxShadow = `0 1px 4px ${colors.background}66`;
                }
              }}
            >
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: isSelected ? '#ffffff' : colors.text,
                marginBottom: '1px',
                lineHeight: '1.1'
              }}>
                {label.groupValue}
              </div>
              <div style={{
                fontSize: '10px',
                color: isSelected ? '#ffffffCC' : colors.textSecondary,
                lineHeight: '1'
              }}>
                {label.metricsCount} metric{label.metricsCount > 1 ? 's' : ''}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};