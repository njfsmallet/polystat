import { memo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export const ErrorDisplay = memo(function ErrorDisplay() {
  const { colors } = useTheme();

  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.error}}>
      <p>Error loading data</p>
    </div>
  );
});