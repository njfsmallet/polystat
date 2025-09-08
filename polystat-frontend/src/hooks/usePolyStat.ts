import { useCallback } from 'react';
import { MetricPoint } from '@/types/polystat';
import { PERFORMANCE, COLORS } from '@/constants/ui';

export const usePolyStat = () => {
  const optimizeGridLayout = useCallback((
    data: MetricPoint[],
    maxHexagons: number = PERFORMANCE.MAX_HEXAGONS_DEFAULT
  ) => {
    if (data.length <= maxHexagons) {
      return data;
    }

    // Sort by descending value to display most critical metrics
    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const sampledData = sortedData.slice(0, maxHexagons);

    // Add truncation indicator if needed
    if (data.length > maxHexagons) {
      const summaryMetric: MetricPoint = {
        name: `+${data.length - maxHexagons} others`,
        value: data.length - maxHexagons,
        labels: { type: 'summary' },
        timestamp: Date.now(),
        color: COLORS.SUMMARY
      };
      sampledData.push(summaryMetric);
    }

    return sampledData;
  }, []);

  return {
    optimizeGridLayout
  };
};
