export interface MetricPoint {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
  color?: string;
  // Group-related properties
  groupOffset?: { x: number; y: number };
  groupArea?: { width: number; height: number };
  groupId?: string;
}

export interface GroupFilter {
  labelKey: string;
  labelValue: string;
  level: number; // Hierarchy level (0 = first filter)
}

export interface GroupByState {
  isActive: boolean;
  groupKey?: string;
  selectedGroupValue?: string;
  previousGroupKey?: string;
  filterStack: GroupFilter[];
  currentLevel: number;
}

export interface GroupLabel {
  groupValue: string;
  groupX: number;
  groupY: number;
  metricsCount: number;
  groupId: string;
}
