import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MetricPoint } from '@/types/polystat';
import { PERFORMANCE } from '@/constants/ui';

const API_BASE_URL = '/api/v1';

interface PrometheusQuery {
  metric: string;
  promql: string;
}

interface PrometheusResponse {
  status: 'success' | 'error';
  data?: MetricPoint[];
  error?: string;
}

const api = {
  async getMetrics(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/prometheus/metrics`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.metrics;
  },

  async executeQuery(query: PrometheusQuery): Promise<MetricPoint[]> {
    const response = await fetch(`${API_BASE_URL}/prometheus/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: PrometheusResponse = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.error || 'Error executing query');
    }
    
    return data.data || [];
  },
};

export const usePrometheus = (promqlQuery: string = '') => {
  const queryClient = useQueryClient();
  const queryData = useQuery({
    queryKey: ['prometheus', 'query', promqlQuery],
    queryFn: async () => {
      if (!promqlQuery.trim()) {
        return [];
      }
      return api.executeQuery({
        metric: '',
        promql: promqlQuery
      });
    },
    enabled: !!promqlQuery.trim(),
    staleTime: Infinity, // No automatic refresh
    cacheTime: Infinity, // Keep cached indefinitely
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false, // No automatic retry
  });

  const currentData = queryData.data || [];

  return {
    data: currentData,
    isLoading: queryData.isLoading && !!promqlQuery.trim(),
    isError: queryData.isError,
    error: queryData.error,
    refetch: () => {
      if (promqlQuery.trim()) {
        queryClient.invalidateQueries({ queryKey: ['prometheus', 'query', promqlQuery] });
      }
    },
  };
};

export const useAvailableMetrics = () => {
  return useQuery({
    queryKey: ['prometheus', 'metrics'],
    queryFn: api.getMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: PERFORMANCE.CACHE_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const useAvailableLabels = (data: MetricPoint[]) => {
  return useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Collect all unique labels from all metrics
    const allLabels = new Set<string>();
    
    data.forEach(metric => {
      if (metric.labels) {
        Object.keys(metric.labels).forEach(labelKey => {
          allLabels.add(labelKey);
        });
      }
    });

    return Array.from(allLabels).sort();
  }, [data]);
};
