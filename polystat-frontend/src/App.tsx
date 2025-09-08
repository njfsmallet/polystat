import { useState, useEffect, useMemo, useCallback } from 'react';
import { HexGrid } from '@/components/PolyStat/HexGrid';
import { FloatingGroupHeaders } from '@/components/PolyStat/FloatingGroupHeaders';
import { LabelSelector } from '@/components/PolyStat/LabelSelector';
import { FilterStack } from '@/components/PolyStat/FilterStack';
import { LoadingSpinner } from '@/components/PolyStat/LoadingSpinner';
import { ErrorDisplay } from '@/components/PolyStat/ErrorDisplay';
import { PromQLInput } from '@/components/PromQLInput';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { MetricPoint, GroupByState, GroupLabel, GroupFilter } from '@/types/polystat';
import { usePrometheus, useAvailableLabels } from '@/hooks/usePrometheus';
import { usePolyStat } from '@/hooks/usePolyStat';

// CSS animation for spinner
const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject keyframes into head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

function App() {
  const { colors } = useTheme();
  const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [promqlQuery, setPromqlQuery] = useState('');
  const [executedQuery, setExecutedQuery] = useState('');
  const [groupByState, setGroupByState] = useState<GroupByState>({ 
    isActive: false, 
    filterStack: [], 
    currentLevel: 0 
  });


  const { data: prometheusData, isLoading, error, refetch } = usePrometheus(executedQuery);
  const { optimizeGridLayout } = usePolyStat();
  
  const executeQuery = useCallback(() => {
    if (promqlQuery.trim() && promqlQuery !== executedQuery) {
      setExecutedQuery(promqlQuery.trim());
      setGroupByState({ 
        isActive: false, 
        filterStack: [], 
        currentLevel: 0 
      });
    } else if (promqlQuery.trim() === executedQuery) {
      refetch();
    }
  }, [promqlQuery, executedQuery, refetch]);
  
  const rawData = useMemo(() => 
    prometheusData?.filter(item => 
      typeof item.value === 'number' && !isNaN(item.value) && isFinite(item.value)
    ) || [], [prometheusData]);
  
  const dataToShow = useMemo(() => {
    return optimizeGridLayout(rawData, 1000);
  }, [rawData, optimizeGridLayout]);
  
  const availableLabels = useAvailableLabels(dataToShow);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setContainerSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleHexClick = useCallback(() => {
    // Hexagon click handler - implement if interaction needed
  }, []);

  // Data grouping logic
  const groupedData = useMemo(() => {
    if (!groupByState.isActive || !groupByState.groupKey || !dataToShow.length) {
      return null;
    }

    // If specific group selected, filter metric data
    let filteredData = dataToShow;
    
    // Apply all filters from stack
    groupByState.filterStack.forEach(filter => {
      filteredData = filteredData.filter(metric => 
        metric.labels[filter.labelKey] === filter.labelValue
      );
    });
    
    if (groupByState.selectedGroupValue && groupByState.previousGroupKey) {
      // Filter metrics belonging to selected group by previous criteria
      filteredData = filteredData.filter(metric => 
        metric.labels[groupByState.previousGroupKey!] === groupByState.selectedGroupValue
      );
    }

    const groups = new Map<string, MetricPoint[]>();
    
    filteredData.forEach(metric => {
      const groupValue = metric.labels[groupByState.groupKey!];
      if (groupValue) {
        if (!groups.has(groupValue)) {
          groups.set(groupValue, []);
        }
        groups.get(groupValue)!.push(metric);
      }
    });

    const result = Array.from(groups.entries()).map(([groupValue, metrics]) => ({
      groupKey: groupByState.groupKey!,
      groupValue,
      metrics
    }));

    return result;
  }, [dataToShow, groupByState]);

  const handleLabelClick = useCallback((labelKey: string) => {
    if (groupByState.isActive && groupByState.groupKey !== labelKey) {
      setGroupByState(prev => ({
        ...prev,
        groupKey: labelKey,
        selectedGroupValue: undefined,
        previousGroupKey: undefined,
        filterStack: prev.filterStack,
        currentLevel: prev.currentLevel
      }));
    } else if (!groupByState.isActive) {
      setGroupByState({
        isActive: true,
        groupKey: labelKey,
        filterStack: [],
        currentLevel: 0
      });
    }
  }, [groupByState.isActive, groupByState.groupKey]);

  const handleResetGroupBy = useCallback(() => {
    setGroupByState({ 
      isActive: false, 
      filterStack: [], 
      currentLevel: 0 
    });
  }, []);

  const groupedClusterLayout = useMemo(() => {
    if (!groupByState.isActive || !groupedData) {
      return null;
    }
    
    
    // SIMPLIFIED APPROACH: Fixed layout - 1/3 for UI, 2/3 for clusters
    const uiHeight = containerSize.height / 3;
    const clustersHeight = containerSize.height * 2 / 3;
    
    const horizontalMargin = containerSize.width * 0.05; // 5% margin on each side
    const availableWidth = containerSize.width - (horizontalMargin * 2);
    const availableHeight = clustersHeight;
    const groupCount = groupedData.length;
    
    // Determine grid layout (columns x rows) with stable placement
    // Use consistent grid sizing to avoid overlaps when filters change
    const aspectRatio = availableWidth / availableHeight;
    const cols = Math.max(1, Math.ceil(Math.sqrt(groupCount * aspectRatio)));
    const rows = Math.max(1, Math.ceil(groupCount / cols));
    
    // ADAPTIVE APPROACH: Consider both group count and density
    
    // Calculate average metrics per group
    const totalMetrics = groupedData.reduce((sum, group) => sum + group.metrics.length, 0);
    const avgMetricsPerGroup = totalMetrics / groupCount;
    
    // Base zoom calculation considering group count - more aggressive zoom out
    let baseZoom = 1;
    if (groupCount <= 2) {
      baseZoom = 0.8; // Light zoom out for 1-2 groups
    } else if (groupCount <= 4) {
      baseZoom = 0.5; // Moderate zoom out for 3-4 groups
    } else if (groupCount <= 6) {
      baseZoom = 0.35; // Strong zoom out for 5-6 groups
    } else {
      baseZoom = 0.25; // Very strong zoom out for 7+ groups
    }
    
    // Density factor: adjust zoom based on metrics per group
    // Low density (few metrics per group) = can zoom in more
    // High density (many metrics per group) = need to zoom out more
    let densityFactor = 1;
    if (avgMetricsPerGroup <= 5) {
      densityFactor = 1.1; // Slight zoom in for sparse groups
    } else if (avgMetricsPerGroup <= 15) {
      densityFactor = 1.0; // Normal density
    } else if (avgMetricsPerGroup <= 30) {
      densityFactor = 0.9; // Slight zoom out for dense groups
    } else {
      densityFactor = 0.8; // Moderate zoom out for very dense groups
    }
    
    let autoZoom = baseZoom * densityFactor;
    
    // Safety bounds
    autoZoom = Math.max(0.1, Math.min(1.0, autoZoom));
    
    const finalZoom = autoZoom;
    
    // Dimensions of each group zone (accounting for required zoom)
    // If finalZoom < 1, need more virtual space to avoid overlaps
    // Invert zoom to enlarge calculation space
    const virtualAvailableWidth = availableWidth / finalZoom;
    const virtualAvailableHeight = availableHeight / finalZoom;
    
    // Add spacing between groups by reducing the area each group can use
    const groupSpacingRatio = 0.60; // Groups use 60% of available space, leaving 40% for spacing
    const groupWidth = (virtualAvailableWidth / cols) * groupSpacingRatio;
    const groupHeight = (virtualAvailableHeight / rows) * groupSpacingRatio;
    
    
    // Prepare data with offsets for each group
    const unifiedData: MetricPoint[] = [];
    const groupLabels: GroupLabel[] = [];
    
    groupedData.forEach((group, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate spacing offset to center groups within their allocated space
      const totalGroupWidth = (virtualAvailableWidth / cols);
      const totalGroupHeight = (virtualAvailableHeight / rows);
      const spacingOffsetX = (totalGroupWidth - groupWidth) / 2;
      const spacingOffsetY = (totalGroupHeight - groupHeight) / 2;
      
      const groupX = horizontalMargin + col * totalGroupWidth + spacingOffsetX;
      // Start clusters at beginning of clusters area (after UI area)
      const groupY = uiHeight + row * totalGroupHeight + spacingOffsetY;
      
      
      // Add metrics with offset
      group.metrics.forEach(metric => {
        unifiedData.push({
          ...metric,
          groupOffset: { x: groupX, y: groupY },
          groupArea: { width: groupWidth, height: groupHeight - 60 },
          groupId: `group-${index}` // Unique identifier for this group
        });
      });
      
      // Header position at group zone center
      groupLabels.push({
        groupValue: group.groupValue,
        groupX: groupX + groupWidth / 2, // Horizontal center of zone
        groupY: groupY + 60, // Small offset from top of group
        metricsCount: group.metrics.length,
        groupId: `group-${index}`
      });
    });
    
    return {
      unifiedData,
      groupLabels,
      finalZoom
    };
  }, [groupedData, containerSize, groupByState.isActive]);

  const handleGroupClick = useCallback((groupValue: string) => {
    setGroupByState(prev => {
      if (prev.selectedGroupValue === groupValue) {
        const newFilterStack = prev.filterStack.slice(0, -1);
        return {
          ...prev,
          selectedGroupValue: undefined,
          previousGroupKey: prev.groupKey,
          filterStack: newFilterStack,
          currentLevel: Math.max(0, prev.currentLevel - 1)
        };
      } else {
        const newFilter: GroupFilter = {
          labelKey: prev.groupKey!,
          labelValue: groupValue,
          level: prev.currentLevel
        };
        
        return {
          ...prev,
          selectedGroupValue: groupValue,
          previousGroupKey: prev.groupKey,
          filterStack: [...prev.filterStack, newFilter],
          currentLevel: prev.currentLevel + 1
        };
      }
    });
  }, []);

  const handleRemoveFilter = useCallback((index: number) => {
    setGroupByState(prev => ({
      ...prev,
      filterStack: prev.filterStack.slice(0, index),
      currentLevel: index,
      selectedGroupValue: undefined
    }));
  }, []);

  const containerStyle = useMemo(() => ({
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background
  }), [colors.background]);

  const navigationStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '16px',
    left: '10%',
    right: '10%',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }), []);

  const queryContainerStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    width: '100%'
  }), []);

  const themeToggleStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    zIndex: 25
  }), []);

  const hexDisplayStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: containerSize.width,
    height: containerSize.height,
    overflow: 'hidden' as const
  }), [containerSize.width, containerSize.height]);

  const groupedContainerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: containerSize.width,
    height: containerSize.height,
    overflow: 'hidden' as const
  }), [containerSize.width, containerSize.height]);

  const noDataStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: colors.textSecondary
  }), [colors.textSecondary]);

  return (
    <div style={containerStyle}>
      {/* Navigation bar and controls */}
      <div style={navigationStyle}>
        {/* PromQL query field and Group By selection */}
        <div style={queryContainerStyle}>
          {/* Modern PromQL query input */}
          <PromQLInput
            value={promqlQuery}
            onChange={setPromqlQuery}
            onExecute={executeQuery}
            isLoading={isLoading}
            placeholder="Enter PromQL query..."
          />
          
                    <LabelSelector
            availableLabels={availableLabels}
            groupByState={groupByState}
            onLabelClick={handleLabelClick}
            onResetGroupBy={handleResetGroupBy}
          />
          
          <FilterStack
            filterStack={groupByState.filterStack}
            onRemoveFilter={handleRemoveFilter}
          />
        </div>
        
      </div>

      {/* Theme toggle button - positioned in top right corner */}
      <div style={themeToggleStyle}>
        <ThemeToggle />
      </div>

      {/* Hexagon display area using full space */}
      <div style={hexDisplayStyle}>
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorDisplay />
        ) : dataToShow.length > 0 ? (
          groupedClusterLayout ? (
            // Grouped mode: unified space with all groups
            <div style={groupedContainerStyle}>
              
              {/* Floating headers synchronized with zoom/pan */}
              <FloatingGroupHeaders
                groupLabels={groupedClusterLayout.groupLabels}
                containerSize={containerSize}
                onGroupClick={handleGroupClick}
                selectedGroupValue={groupByState.selectedGroupValue}
              />
              
              {/* Unified hexagonal grid */}
              <HexGrid
                data={groupedClusterLayout.unifiedData}
                width={containerSize.width}
                height={containerSize.height}
                hexSize="auto"
                onHexClick={handleHexClick}
                onLabelClick={handleLabelClick}
                hiddenLabelKey={groupByState.groupKey}
                initialZoom={groupedClusterLayout.finalZoom}
                isGrouped={true}
              />
            </div>
          ) : (
            // Normal mode: single grid
            <HexGrid
              data={dataToShow}
              width={containerSize.width}
              height={containerSize.height}
              onHexClick={handleHexClick}
              onLabelClick={handleLabelClick}
              isGrouped={false}
            />
          )
        ) : executedQuery ? (
          <div style={noDataStyle}>
            <p>No data found for this query</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
