export const formatMetricValue = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } 
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(1);
};

export const sanitizeId = (id: string): string => {
  return id.replace(/[^a-zA-Z0-9]/g, '') || 'default';
};