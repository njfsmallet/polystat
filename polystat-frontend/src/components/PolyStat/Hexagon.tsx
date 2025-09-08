import React, { useMemo } from 'react';
import { MetricPoint } from '@/types/polystat';
import { measureText } from '@/utils/textMeasure';
import { formatMetricValue, sanitizeId } from '@/utils/formatters';
import { HEX_DISPLAY_THRESHOLDS, FONT_SIZES, HEX_LAYOUT } from '@/constants/ui';

interface HexagonProps {
  x: number;
  y: number;
  size: number;
  data: MetricPoint;
  onClick: (data: MetricPoint) => void;
  onLabelClick?: (labelKey: string, labelValue: string) => void;
  zoom: number; // Zoom level for progressive display
  hiddenLabelKey?: string; // Label key to hide (used for grouping)
  zoomLimits?: { min: number; max: number }; // Zoom limits for progression calculation
}

export const Hexagon: React.FC<HexagonProps> = ({
  x,
  y,
  size,
  data,
  onClick,
  onLabelClick,
  zoom = 1,
  hiddenLabelKey,
  zoomLimits,
}) => {
  const validX = isFinite(x) ? x : 0;
  const validY = isFinite(y) ? y : 0;
  const validSize = size > 0 ? size : 20;

  // Calculate hexagon points with top vertex
  const hexPoints = useMemo(() => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      // Offset of -π/2 to have vertex at top
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      const px = validX + validSize * Math.cos(angle);
      const py = validY + validSize * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  }, [validX, validY, validSize]);

  const formattedValue = useMemo(() => {
    return formatMetricValue(data.value);
  }, [data.value]);

  const minZoom = zoomLimits?.min || 0.1;
  const maxZoom = zoomLimits?.max || 10;
  const zoomProgress = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));

  const displayInfo = useMemo(() => {
    const labels = data.labels || {};
    const labelKeys = Object.keys(labels).filter(key => key !== hiddenLabelKey);
    
    const hexagonScreenSize = validSize * zoom;
    
    const detailLevel: 'basic' | 'detailed' | 'full' = 
      hexagonScreenSize < HEX_DISPLAY_THRESHOLDS.BASIC ? 'basic' :
      hexagonScreenSize < HEX_DISPLAY_THRESHOLDS.DETAILED ? 'detailed' :
      'full';
    
    const isVerySmall = hexagonScreenSize < HEX_DISPLAY_THRESHOLDS.VERY_SMALL;
    
    if (isVerySmall) {
      return {
        primaryText: { lines: [''], shouldWrap: false },
        secondaryText: { lines: [''], shouldWrap: false },
        tertiaryText: { lines: [''], shouldWrap: false },
        quaternaryText: { lines: [''], shouldWrap: false },
        detailLevel,
        shouldShowValue: true,
        primaryFontSize: 0,
        secondaryFontSize: 0,
        tertiaryFontSize: 0,
        quaternaryFontSize: 0,
        primaryY: validY,
        secondaryY: validY,
        tertiaryY: validY,
        quaternaryY: validY,
        labelKeys: [],
        labelValues: [],
        tooltip: `name="${data.name}"`
      };
    }
    
    // Calculate font size in logical units consistent with SVG
    const prepareText = (text: string, maxFontSize: number, yPosition: number) => {
      const logicalHexWidth = validSize * HEX_LAYOUT.SQRT_3;
      const relativeY = (yPosition - validY) / validSize;
      
      // Available width in logical units (will be zoomed by SVG)
      let availableLogicalWidth;
      if (Math.abs(relativeY) <= 0.3) {
        availableLogicalWidth = logicalHexWidth * 0.85; // Central zone: 85%
      } else if (Math.abs(relativeY) <= 0.6) {
        const reduction = (Math.abs(relativeY) - 0.3) / 0.3;
        availableLogicalWidth = logicalHexWidth * (0.85 - reduction * 0.25);
      } else {
        const reduction = (Math.abs(relativeY) - 0.6) / 0.4;
        availableLogicalWidth = logicalHexWidth * (0.60 - reduction * 0.20);
      }

      // Automatic font size adjustment in logical units
      let optimalFontSize = maxFontSize;
      let textWidth = measureText(text, optimalFontSize);
      
      const minAcceptableSize = Math.max(4, maxFontSize * 0.4);
      
      while (textWidth > availableLogicalWidth && optimalFontSize > minAcceptableSize) {
        optimalFontSize *= 0.90;
        textWidth = measureText(text, optimalFontSize);
      }
      
      if (textWidth > availableLogicalWidth) {
        optimalFontSize = (availableLogicalWidth / textWidth) * optimalFontSize;
        optimalFontSize = Math.max(2, optimalFontSize);
        textWidth = measureText(text, optimalFontSize);
      }


      return {
        lines: [text],
        shouldWrap: false,
        optimalFontSize: optimalFontSize
      };
    };
    
    let primaryText = { lines: [''], shouldWrap: false };
    let secondaryText = { lines: [''], shouldWrap: false };
    let tertiaryText = { lines: [''], shouldWrap: false };
    let quaternaryText = { lines: [''], shouldWrap: false };
    
    // Intelligent font size that exploits hexagon space better
    const baseSize = Math.max(3, Math.min(12, validSize * FONT_SIZES.BASE_MULTIPLIER / Math.max(zoom, FONT_SIZES.MIN_ZOOM_FACTOR)));
    
    // Maximum sizes per level (will be automatically adjusted by prepareText)
    const primaryFontSize = baseSize;
    const secondaryFontSize = baseSize * FONT_SIZES.SECONDARY_MULTIPLIER;
    const tertiaryFontSize = baseSize * FONT_SIZES.TERTIARY_MULTIPLIER;
    const quaternaryFontSize = baseSize * FONT_SIZES.QUATERNARY_MULTIPLIER;
    
    
    // Y positions for each text level
    const primaryY = validY + validSize * 0.05;
    const secondaryY = validY + validSize * 0.3;
    const tertiaryY = validY + validSize * 0.5;
    const quaternaryY = validY + validSize * 0.65;
    
    if (labelKeys.length > 0) {
      const sortedKeys = labelKeys.sort();
      
      switch (detailLevel) {
        case 'basic':
          primaryText = prepareText(labels[sortedKeys[0]] || data.name, primaryFontSize, primaryY);
          break;
        case 'detailed':
          primaryText = prepareText(labels[sortedKeys[0]] || data.name, primaryFontSize, primaryY);
          if (sortedKeys.length > 1) {
            secondaryText = prepareText(labels[sortedKeys[1]] || '', secondaryFontSize, secondaryY);
          }
          break;
        case 'full':
          primaryText = prepareText(labels[sortedKeys[0]] || data.name, primaryFontSize, primaryY);
          if (sortedKeys.length > 1) {
            secondaryText = prepareText(labels[sortedKeys[1]] || '', secondaryFontSize, secondaryY);
          }
          if (sortedKeys.length > 2) {
            tertiaryText = prepareText(labels[sortedKeys[2]] || '', tertiaryFontSize, tertiaryY);
          }
          if (sortedKeys.length > 3) {
            quaternaryText = prepareText(labels[sortedKeys[3]] || '', quaternaryFontSize, quaternaryY);
          }
          break;
      }
    } else {
      primaryText = prepareText(data.name, primaryFontSize, primaryY);
    }
    
    // Calculate optimal size for main value with automatic adjustment
    const valueY = validY - validSize * 0.35;
    const valueTextInfo = prepareText(formattedValue, baseSize * FONT_SIZES.VALUE_MULTIPLIER, valueY);
    
    return {
      primaryText,
      secondaryText,
      tertiaryText,
      quaternaryText,
      detailLevel,
      shouldShowValue: true,
      primaryFontSize,
      secondaryFontSize,
      tertiaryFontSize,
      quaternaryFontSize,
      valueFontSize: valueTextInfo.optimalFontSize,
      primaryY,
      secondaryY,
      tertiaryY,
      quaternaryY,
      labelKeys: labelKeys.length > 0 ? labelKeys.sort() : [],
      labelValues: labelKeys.length > 0 ? labelKeys.sort().map((key: string) => labels[key]) : [],
      tooltip: labelKeys.length > 0 
        ? labelKeys.map(key => `${key}="${labels[key]}"`).join(', ')
        : `name="${data.name}"`
    };
  }, [zoom, zoomLimits, data.labels, data.name, hiddenLabelKey, validSize, validX, validY, formattedValue]);

  const fillColor = data.color || '#3B82F6';
  const handleClick = () => onClick(data);

  // Helper function to display text with click handling
  const renderText = (
    textData: { lines: string[], shouldWrap: boolean, optimalFontSize?: number },
    x: number,
    y: number,
    fontSize: number,
    fill: string,
    fontWeight?: number,
    labelKey?: string,
    labelValue?: string
  ) => {
    if (!textData.lines[0]) return null;

    const effectiveFontSize = textData.optimalFontSize || fontSize;

    const handleLabelClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onLabelClick && labelKey && labelValue) {
        onLabelClick(labelKey, labelValue);
      }
    };

    // Labels are not clickable - selection interface is now under PromQL field
    const isClickable = false;

    if (textData.lines.length === 1) {
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          style={{
            fontSize: `${effectiveFontSize}px`,
            fontWeight: fontWeight || 500,
            fill,
            pointerEvents: isClickable ? 'auto' : 'none',
            userSelect: 'none',
            cursor: isClickable ? 'pointer' : 'default',
            textDecoration: isClickable ? 'underline' : 'none',
          }}
          onClick={isClickable ? handleLabelClick : undefined}
        >
          {textData.lines[0]}
        </text>
      );
    }

    // Multi-line (future extension)
    return textData.lines.map((line, index) => (
      <text
        key={index}
        x={x}
        y={y + index * effectiveFontSize * 1.1}
        textAnchor="middle"
        style={{
          fontSize: `${effectiveFontSize}px`,
          fontWeight: fontWeight || 500,
          fill,
          pointerEvents: isClickable ? 'auto' : 'none',
          userSelect: 'none',
          cursor: isClickable ? 'pointer' : 'default',
          textDecoration: isClickable ? 'underline' : 'none'
        }}
        onClick={isClickable ? handleLabelClick : undefined}
      >
        {line}
      </text>
    ));
  };

  const shadowId = `valueShadow-${sanitizeId(data.name)}`;

  return (
    <g>
      {/* SVG filter definitions for shadows */}
      <defs>
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.3" floodColor="rgba(0, 0, 0, 0.7)" floodOpacity="1"/>
        </filter>
      </defs>
      
      {/* Main hexagon with modern visible border */}
      <polygon
        points={hexPoints}
        fill={fillColor}
        stroke="rgba(0, 0, 0, 0.35)"
        strokeWidth={1.2}
        style={{ 
          cursor: 'pointer',
        }}
        onClick={handleClick}
      />
      
      {/* Progressive display optimized based on zoom */}
      
      {/* Main value with modern style */}
      <text
        x={validX}
        y={validY - validSize * 0.35}
        textAnchor="middle"
        style={{
          fontSize: `${displayInfo.valueFontSize}px`,
          fontWeight: 700,
          fill: 'rgba(255, 255, 255, 0.98)',
          pointerEvents: 'none',
          userSelect: 'none',
          filter: `url(#${shadowId})`
        }}
      >
        {formattedValue}
      </text>
      
      {/* Primary label - visible from basic zoom */}
      {displayInfo.primaryText.lines[0] && 
        renderText(
          displayInfo.primaryText,
          validX,
          displayInfo.primaryY,
          displayInfo.primaryFontSize,
          'rgba(0, 0, 0, 0.9)',
          500
        )
      }
      
      {/* Secondary label - visible from detailed zoom */}
      {displayInfo.secondaryText.lines[0] && (displayInfo.detailLevel === 'detailed' || displayInfo.detailLevel === 'full') && 
        renderText(
          displayInfo.secondaryText,
          validX,
          displayInfo.secondaryY,
          displayInfo.secondaryFontSize,
          'rgba(0, 0, 0, 0.8)',
          400
        )
      }
      
      {/* Tertiary label - visible only in full zoom */}
      {displayInfo.tertiaryText.lines[0] && displayInfo.detailLevel === 'full' && 
        renderText(
          displayInfo.tertiaryText,
          validX,
          displayInfo.tertiaryY,
          displayInfo.tertiaryFontSize,
          'rgba(0, 0, 0, 0.7)',
          400
        )
      }
      
      {/* Quaternary label - visible only in high full zoom (>50% progression) */}
      {displayInfo.quaternaryText.lines[0] && displayInfo.detailLevel === 'full' && zoomProgress > 0.5 && 
        renderText(
          displayInfo.quaternaryText,
          validX,
          displayInfo.quaternaryY,
          displayInfo.quaternaryFontSize,
          'rgba(0, 0, 0, 0.6)',
          300
        )
      }
      
      
    </g>
  );
};
