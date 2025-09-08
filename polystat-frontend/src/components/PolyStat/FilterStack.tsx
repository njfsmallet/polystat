import { memo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { GroupFilter } from '@/types/polystat';

interface FilterStackProps {
  filterStack: GroupFilter[];
  onRemoveFilter: (index: number) => void;
}

export const FilterStack = memo(function FilterStack({ filterStack, onRemoveFilter }: FilterStackProps) {
  const { colors } = useTheme();

  if (filterStack.length === 0) return null;

  return (
    <div 
      data-filter-stack
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        width: '100%',
        padding: '2px 0',
        fontSize: '11px',
        color: '#6b7280',
        marginTop: '4px',
        transition: 'margin-top 0.15s ease'
      }}>
      {filterStack.map((filter, index) => (
        <div key={index} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '10px'
        }}>
          <span style={{ color: colors.textSecondary }}>{filter.labelKey}:</span>
          <span style={{ fontWeight: '500' }}>{filter.labelValue}</span>
          <button
            onClick={() => onRemoveFilter(index)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: '10px',
              padding: '0',
              marginLeft: '4px',
              fontWeight: 'bold'
            }}
            title="Remove this filter and all following"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
});