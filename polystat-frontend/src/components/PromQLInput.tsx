import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAvailableMetrics } from '@/hooks/usePrometheus';
import { useTheme } from '@/contexts/ThemeContext';

interface PromQLInputProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

interface AutocompleteItem {
  type: 'metric' | 'function' | 'operator' | 'keyword';
  name: string;
  description?: string;
  value: string;
}

export const PromQLInput: React.FC<PromQLInputProps> = ({
  value,
  onChange,
  onExecute,
  isLoading = false,
  placeholder = "Enter PromQL query...",
}) => {
  const { colors } = useTheme();
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [wordStart, setWordStart] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  
  // Get available metrics
  const { data: metrics = [] } = useAvailableMetrics();
  
  // Common PromQL functions
  const promqlFunctions = [
    { name: 'rate', description: 'Rate of increase per second', value: 'rate' },
    { name: 'increase', description: 'Increase over time', value: 'increase' },
    { name: 'sum', description: 'Sum of values', value: 'sum' },
    { name: 'avg', description: 'Average of values', value: 'avg' },
    { name: 'max', description: 'Maximum value', value: 'max' },
    { name: 'min', description: 'Minimum value', value: 'min' },
    { name: 'count', description: 'Count of values', value: 'count' },
    { name: 'histogram_quantile', description: 'Quantile from histogram', value: 'histogram_quantile' },
    { name: 'delta', description: 'Difference between first and last value', value: 'delta' },
    { name: 'deriv', description: 'Rate of change', value: 'deriv' },
    { name: 'predict_linear', description: 'Linear prediction', value: 'predict_linear' },
    { name: 'abs', description: 'Absolute value', value: 'abs' },
    { name: 'ceil', description: 'Ceiling function', value: 'ceil' },
    { name: 'floor', description: 'Floor function', value: 'floor' },
    { name: 'round', description: 'Round to nearest integer', value: 'round' },
    { name: 'scalar', description: 'Convert vector to scalar', value: 'scalar' },
    { name: 'vector', description: 'Convert scalar to vector', value: 'vector' },
    { name: 'time', description: 'Current timestamp', value: 'time' },
    { name: 'timestamp', description: 'Timestamp of sample', value: 'timestamp' },
  ];

  // PromQL operators
  const promqlOperators = [
    { name: '+', description: 'Addition', value: '+' },
    { name: '-', description: 'Subtraction', value: '-' },
    { name: '*', description: 'Multiplication', value: '*' },
    { name: '/', description: 'Division', value: '/' },
    { name: '%', description: 'Modulo', value: '%' },
    { name: '^', description: 'Power', value: '^' },
    { name: '==', description: 'Equal', value: '==' },
    { name: '!=', description: 'Not equal', value: '!=' },
    { name: '>', description: 'Greater than', value: '>' },
    { name: '<', description: 'Less than', value: '<' },
    { name: '>=', description: 'Greater than or equal', value: '>=' },
    { name: '<=', description: 'Less than or equal', value: '<=' },
    { name: 'and', description: 'Logical AND', value: 'and' },
    { name: 'or', description: 'Logical OR', value: 'or' },
    { name: 'unless', description: 'Logical unless', value: 'unless' },
  ];

  // PromQL keywords
  const promqlKeywords = [
    { name: 'by', description: 'Group by labels', value: 'by' },
    { name: 'without', description: 'Group without labels', value: 'without' },
    { name: 'offset', description: 'Time offset', value: 'offset' },
    { name: 'on', description: 'Join on labels', value: 'on' },
    { name: 'ignoring', description: 'Join ignoring labels', value: 'ignoring' },
    { name: 'group_left', description: 'Left join', value: 'group_left' },
    { name: 'group_right', description: 'Right join', value: 'group_right' },
  ];

  // Parse text around cursor to get current word
  const getCurrentWord = useCallback((text: string, position: number) => {
    const beforeCursor = text.slice(0, position);
    const afterCursor = text.slice(position);
    
    // Find start of current word
    const wordStartMatch = beforeCursor.match(/[a-zA-Z0-9_:]*$/);
    const wordStart = wordStartMatch ? position - wordStartMatch[0].length : position;
    
    // Find end of current word
    const wordEndMatch = afterCursor.match(/^[a-zA-Z0-9_:]*/);
    const wordEnd = wordEndMatch ? position + wordEndMatch[0].length : position;
    
    return {
      word: text.slice(wordStart, wordEnd),
      start: wordStart,
      end: wordEnd
    };
  }, []);

  // Filter autocomplete suggestions
  const filterAutocompleteItems = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    const items: AutocompleteItem[] = [];

    // Add metrics that START with query (sorted alphabetically)
    const matchingMetrics = metrics
      .filter((metric: string) => metric.toLowerCase().startsWith(lowerQuery))
      .sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    matchingMetrics.forEach((metric: string) => {
      items.push({
        type: 'metric',
        name: metric,
        description: 'Metric',
        value: metric
      });
    });

    // Add matching functions
    promqlFunctions.forEach(func => {
      if (func.name.toLowerCase().includes(lowerQuery)) {
        items.push({
          type: 'function',
          name: func.name,
          description: func.description,
          value: func.name
        });
      }
    });

    // Add matching operators
    promqlOperators.forEach(op => {
      if (op.name.toLowerCase().includes(lowerQuery)) {
        items.push({
          type: 'operator',
          name: op.name,
          description: op.description,
          value: op.name
        });
      }
    });

    // Add matching keywords
    promqlKeywords.forEach(keyword => {
      if (keyword.name.toLowerCase().includes(lowerQuery)) {
        items.push({
          type: 'keyword',
          name: keyword.name,
          description: keyword.description,
          value: keyword.name
        });
      }
    });

    return items.slice(0, 20); // Limit to 20 suggestions
  }, [metrics]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newPosition = e.target.selectionStart || 0;
    
    onChange(newValue);
    
    const { word, start } = getCurrentWord(newValue, newPosition);
    setCurrentWord(word);
    setWordStart(start);
    
    // Show autocomplete if we have a word
    if (word.length > 0) {
      const items = filterAutocompleteItems(word);
      setAutocompleteItems(items);
      setShowAutocomplete(items.length > 0);
      setSelectedIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  };

  // Insert autocomplete suggestion
  const insertSuggestion = (suggestion: AutocompleteItem) => {
    const beforeWord = value.slice(0, wordStart);
    const afterWord = value.slice(wordStart + currentWord.length);
    const newValue = beforeWord + suggestion.value + afterWord;
    
    onChange(newValue);
    setShowAutocomplete(false);
    
    // Position cursor after insertion
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = wordStart + suggestion.value.length;
        inputRef.current.setSelectionRange(newPosition, newPosition);
        inputRef.current.focus();
      }
    }, 0);
  };

  // Handle query execution
  const handleExecute = () => {
    onExecute();
  };

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete && autocompleteItems.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < autocompleteItems.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : autocompleteItems.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < autocompleteItems.length) {
            insertSuggestion(autocompleteItems[selectedIndex]);
          } else {
            handleExecute();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowAutocomplete(false);
          break;
        case 'Tab':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < autocompleteItems.length) {
            insertSuggestion(autocompleteItems[selectedIndex]);
          }
          break;
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  // Handle click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current && 
        !autocompleteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get icon for element type
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'metric':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"/>
            <path d="m9 9 3 3 3-3"/>
          </svg>
        );
      case 'function':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/>
            <path d="M12 3v18"/>
            <path d="M8 12h8"/>
          </svg>
        );
      case 'operator':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6"/>
            <path d="M12 17v6"/>
            <path d="M4.22 4.22l4.24 4.24"/>
            <path d="M15.54 15.54l4.24 4.24"/>
            <path d="M1 12h6"/>
            <path d="M17 12h6"/>
            <path d="M4.22 19.78l4.24-4.24"/>
            <path d="M15.54 8.46l4.24-4.24"/>
          </svg>
        );
      case 'keyword':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4"/>
            <path d="M21 12c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z"/>
            <path d="M3 12c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2z"/>
            <path d="M12 3c0 1-1 2-2 2s-2-1-2-2 1-2 2-2 2 1 2 2z"/>
            <path d="M12 21c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z"/>
          </svg>
        );
      default:
        return null;
    }
  };

    // Get color for element type
  const getItemColor = (type: string) => {
    switch (type) {
      case 'metric':
        return '#3b82f6'; // Blue
      case 'function':
        return '#10b981'; // Green
      case 'operator':
        return '#f59e0b'; // Yellow
      case 'keyword':
        return '#8b5cf6'; // Purple
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <div style={{position: 'relative'}}>
      {/* Main input with original style */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
      }}>
        {/* Search icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px',
          paddingRight: '12px',
          color: colors.textSecondary
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        
        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '14px 0',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: colors.text
          }}
          onFocus={(e) => {
            e.target.parentElement?.style.setProperty('borderColor', colors.accent);
            e.target.parentElement?.style.setProperty('boxShadow', '0 0 0 3px rgba(59, 130, 246, 0.1)');
          }}
          onBlur={(e) => {
            e.target.parentElement?.style.setProperty('borderColor', colors.border);
            e.target.parentElement?.style.setProperty('boxShadow', '0 1px 2px 0 rgba(0, 0, 0, 0.05)');
          }}
          disabled={isLoading}
        />
        
        {/* Execute button */}
        <button
          onClick={handleExecute}
          disabled={isLoading || !value.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '500',
            color: (isLoading || !value.trim()) ? colors.textSecondary : 'white',
            backgroundColor: (isLoading || !value.trim()) ? colors.background : colors.accent,
            border: 'none',
            cursor: (isLoading || !value.trim()) ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            borderLeft: `1px solid ${colors.background}`,
            marginLeft: '8px',
            opacity: (isLoading || !value.trim()) ? 0.6 : 1,
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && value.trim()) {
              e.currentTarget.style.backgroundColor = colors.accent;
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && value.trim()) {
              e.currentTarget.style.backgroundColor = colors.accent;
              e.currentTarget.style.color = 'white';
            } else if (isLoading || !value.trim()) {
              e.currentTarget.style.backgroundColor = colors.background;
              e.currentTarget.style.color = colors.textSecondary;
            }
          }}
        >
          Execute
        </button>
      </div>

      {/* Autocomplete */}
      {showAutocomplete && autocompleteItems.length > 0 && (
        <div
          ref={autocompleteRef}
          style={{
            position: 'absolute',
            zIndex: 50,
            width: '100%',
            marginTop: '4px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            maxHeight: '320px',
            overflowY: 'auto'
          }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {autocompleteItems.map((item, index) => (
            <div
              key={`${item.type}-${item.name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                backgroundColor: index === selectedIndex ? colors.background : 'transparent',
                borderLeft: index === selectedIndex ? `2px solid ${colors.accent}` : '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = colors.background;
                }
              }}
              onMouseLeave={(e) => {
                if (index !== selectedIndex) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              onClick={() => insertSuggestion(item)}
            >
              {/* Icon */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  marginRight: '12px',
                  color: getItemColor(item.type)
                }}
              >
                {getItemIcon(item.type)}
              </div>
              
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    color: colors.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.name}
                  </span>
                </div>
                {item.description && (
                  <div style={{
                    fontSize: '12px',
                    color: colors.textSecondary,
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
