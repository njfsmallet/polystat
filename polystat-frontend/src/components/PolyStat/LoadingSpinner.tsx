import { memo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export const LoadingSpinner = memo(function LoadingSpinner() {
  const { colors } = useTheme();

  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
      <div style={{
        width: '48px', 
        height: '48px', 
        border: `2px solid ${colors.accent}`, 
        borderTop: '2px solid transparent', 
        borderRadius: '50%', 
        animation: 'spin 1s linear infinite'
      }}></div>
    </div>
  );
});