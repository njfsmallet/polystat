import { createContext, useContext, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
}

const lightTheme: ThemeColors = {
  background: '#f9fafb',
  surface: '#ffffff',
  primary: '#1f2937',
  secondary: '#6b7280',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  accent: '#007bff',
  error: '#e63946',
  success: '#06d6a0',
  warning: '#f77f00'
};

const darkTheme: ThemeColors = {
  background: '#111827',
  surface: '#1f2937',
  primary: '#f9fafb',
  secondary: '#9ca3af',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  border: '#374151',
  accent: '#3b82f6',
  error: '#e63946',
  success: '#06d6a0',
  warning: '#f77f00'
};

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const colors = theme === 'dark' ? darkTheme : lightTheme;

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const value = {
    theme,
    colors,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};