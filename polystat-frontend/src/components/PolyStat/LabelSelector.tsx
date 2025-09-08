import { useRef, useEffect, useState, memo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface LabelSelectorProps {
  availableLabels: string[];
  groupByState: {
    isActive: boolean;
    groupKey?: string;
  };
  onLabelClick: (label: string) => void;
  onResetGroupBy: () => void;
}

export const LabelSelector = memo(function LabelSelector({ 
  availableLabels, 
  groupByState, 
  onLabelClick, 
  onResetGroupBy 
}: LabelSelectorProps) {
  const { colors, theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleLabelsCount, setVisibleLabelsCount] = useState(3);
  const labelsContainerRef = useRef<HTMLDivElement>(null);

  const toggleLabelsExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const calculateVisibleLabelsCount = () => {
    if (!labelsContainerRef.current || availableLabels.length === 0) return 3;
    
    const containerWidth = labelsContainerRef.current.offsetWidth;
    const gap = 4; // Gap between labels  
    
    // Create canvas for text measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 3;
    context.font = '500 11px system-ui, -apple-system, sans-serif';
    
    // Try different numbers of visible labels to find the optimal count
    for (let testCount = availableLabels.length; testCount >= 1; testCount--) {
      // Calculate total width of labels
      let labelsWidth = 0;
      for (let i = 0; i < testCount; i++) {
        const label = availableLabels[i];
        const textWidth = context.measureText(label).width;
        // Add extra padding for safety: padding (8px * 2) + border (2px * 2) + potential × symbol (16px if selected)
        const labelWidth = Math.ceil(textWidth) + 20 + (groupByState.isActive && groupByState.groupKey === label ? 16 : 0);
        labelsWidth += labelWidth + (i > 0 ? gap : 0);
      }
      
      // Calculate expand button width if needed
      let expandButtonWidth = 0;
      if (testCount < availableLabels.length) {
        const hiddenCount = availableLabels.length - testCount;
        const expandText = `+${hiddenCount}`;
        const expandTextWidth = context.measureText(expandText).width;
        // Add more safety margin for expand button: svg + gap + padding + text + extra margin
        expandButtonWidth = Math.ceil(expandTextWidth) + 10 + 3 + 20 + gap;
      }
      
      // Add generous safety margin to prevent any truncation
      const safetyMargin = 20;
      const totalRequiredWidth = labelsWidth + expandButtonWidth + safetyMargin;
      
      if (totalRequiredWidth <= containerWidth) {
        return testCount;
      }
    }
    
    return 1;
  };

  useEffect(() => {
    const newCount = calculateVisibleLabelsCount();
    setVisibleLabelsCount(newCount);
  }, [availableLabels, groupByState]);

  useEffect(() => {
    if (!labelsContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      const newCount = calculateVisibleLabelsCount();
      setVisibleLabelsCount(newCount);
    });

    resizeObserver.observe(labelsContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [availableLabels, groupByState]);

  const handleLabelClick = (label: string) => {
    const isSelected = groupByState.isActive && groupByState.groupKey === label;
    if (isSelected) {
      onResetGroupBy();
    } else {
      onLabelClick(label);
    }
    setIsExpanded(false);
  };

  if (availableLabels.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <div 
        ref={labelsContainerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'nowrap',
          width: '100%',
          minHeight: '32px',
          padding: '4px 0',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div style={{
          display: isExpanded ? 'none' : 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'nowrap',
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden'
        }}>
          {availableLabels.slice(0, visibleLabelsCount).map(label => {
            const isSelected = groupByState.isActive && groupByState.groupKey === label;
            return (
              <button
                key={label}
                onClick={() => handleLabelClick(label)}
                style={{
                  background: isSelected ? colors.primary : colors.surface,
                  border: '1px solid',
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: isSelected ? (theme === 'dark' ? '#1f2937' : '#ffffff') : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  backdropFilter: 'blur(2px)',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = colors.background;
                    e.currentTarget.style.borderColor = colors.secondary;
                    e.currentTarget.style.color = colors.text;
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                  } else {
                    e.currentTarget.style.backgroundColor = colors.text;
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = colors.surface;
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.color = colors.textSecondary;
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                  } else {
                    e.currentTarget.style.backgroundColor = colors.primary;
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }
                }}
                title={label}
              >
                {label}
                {isSelected && (
                  <span
                    style={{
                      marginLeft: '4px',
                      fontSize: '10px',
                      opacity: 0.9,
                      fontWeight: '400'
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {availableLabels.length > visibleLabelsCount && !isExpanded && (
          <button
            onClick={toggleLabelsExpanded}
            style={{
              background: colors.accent,
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: '500',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              minWidth: 'fit-content',
              maxWidth: '150px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.accent;
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <span>+{availableLabels.length - visibleLabelsCount}</span>
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div 
          style={{
            display: 'block',
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            backgroundColor: `${colors.background}80`,
            border: 'none',
            borderRadius: '8px',
            padding: '4px 0',
            boxShadow: 'none',
            zIndex: 25,
            overflow: 'visible'
          }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
          paddingRight: '80px'
        }}>
          {availableLabels.map(label => {
            const isSelected = groupByState.isActive && groupByState.groupKey === label;
            return (
              <button
                key={`expanded-${label}`}
                onClick={() => handleLabelClick(label)}
                style={{
                  background: isSelected ? colors.primary : colors.surface,
                  border: '1px solid',
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: isSelected ? (theme === 'dark' ? '#1f2937' : '#ffffff') : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                  whiteSpace: 'nowrap'
                }}
                title={label}
              >
                {label}
                {isSelected && (
                  <span
                    style={{
                      marginLeft: '4px',
                      fontSize: '10px',
                      opacity: 0.9,
                      fontWeight: '400'
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={toggleLabelsExpanded}
          style={{
            position: 'absolute',
            top: '4px',
            right: '0px',
            background: '#007bff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: '500',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            minWidth: 'fit-content',
            maxWidth: '150px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            zIndex: 26
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0056b3';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#007bff';
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18,15 12,9 6,15"></polyline>
          </svg>
          Less
        </button>
        </div>
      )}
    </div>
  );
});