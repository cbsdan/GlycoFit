import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * TimelinePredictionCard
 * 
 * Displays timeline predictions showing what may happen if current patterns continue.
 * Based on research studies with proper citations.
 * 
 * Props:
 * - predictions: Object containing timeline predictions (3_months, 6_months, 1_year)
 * - title: Card title (e.g., "Timeline Predictions")
 * - iconName: Icon name for the header
 * - iconColor: Color for the icon
 */
const TimelinePredictionCard = ({ 
  predictions, 
  title = "Timeline Predictions",
  subtitle = "What may happen if current pattern continues",
  iconName = "timeline-clock",
  iconColor = "#3498DB",
  expanded = false,
  onToggleExpand
}) => {
  const { colors } = useTheme();
  
  if (!predictions || Object.keys(predictions).length === 0) {
    return null;
  }

  const timelineLabels = {
    '1_week': '1 Week',
    '1_month': '1 Month',
    '3_months': '3 Months',
    '6_months': '6 Months',
    '1_year': '1 Year',
    'continued_1_year': 'If Continued (1 Year)',
    'if_quit_now': 'If You Quit Now',
    'continued_abstinence': 'Continued Abstinence'
  };

  const getImpactColor = (impact) => {
    if (!impact) return colors.secondary;
    const lowerImpact = impact.toLowerCase();
    if (lowerImpact.includes('increase') || lowerImpact.includes('elevated') || 
        lowerImpact.includes('decrease') && lowerImpact.includes('sensitivity')) {
      return '#E74C3C';
    }
    if (lowerImpact.includes('stable') || lowerImpact.includes('maintain') || 
        lowerImpact.includes('optimal') || lowerImpact.includes('protective')) {
      return '#27AE60';
    }
    if (lowerImpact.includes('approaching') || lowerImpact.includes('reduced') ||
        lowerImpact.includes('decline')) {
      return '#F39C12';
    }
    return colors.secondary;
  };

  const renderTimelineItem = (key, data) => {
    if (!data) return null;
    
    const label = timelineLabels[key] || key.replace(/_/g, ' ');
    const impact = typeof data === 'string' ? data : data.impact || data.projected_risk_change;
    const description = typeof data === 'object' ? data.description : null;
    const research = typeof data === 'object' ? data.research : null;
    const isReversible = typeof data === 'object' ? data.reversible : null;
    
    return (
      <View key={key} style={[styles.timelineItem, { borderLeftColor: iconColor }]}>
        <View style={styles.timelineDot}>
          <View style={[styles.dot, { backgroundColor: iconColor }]} />
        </View>
        <View style={styles.timelineContent}>
          <Text style={[styles.timelineLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.timelineImpact, { color: getImpactColor(impact) }]}>
            {impact}
          </Text>
          {description && (
            <Text style={[styles.description, { color: colors.secondary }]}>
              {description}
            </Text>
          )}
          {isReversible !== null && (
            <View style={styles.reversibleTag}>
              <Icon 
                name={isReversible ? "refresh" : "alert-circle"} 
                size={12} 
                color={isReversible ? "#27AE60" : "#E74C3C"} 
              />
              <Text style={[styles.reversibleText, { color: isReversible ? "#27AE60" : "#E74C3C" }]}>
                {isReversible ? "Reversible" : "Harder to reverse"}
              </Text>
            </View>
          )}
          {research && (
            <Text style={[styles.research, { color: colors.secondary }]}>
              📚 {research}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render nested predictions (like "if_quit_now" with sub-items)
  const renderNestedPredictions = (data) => {
    if (typeof data === 'object' && !data.impact && !data.projected_risk_change) {
      const entries = Object.entries(data).filter(([key]) => key !== 'research');
      const renderedItems = [];
      const processedKeys = new Set();
      
      entries.forEach(([key, value]) => {
        // Skip if already processed or if it's a description field
        if (processedKeys.has(key) || key.endsWith('_description')) {
          return;
        }
        
        processedKeys.add(key);
        const descriptionKey = `${key}_description`;
        const description = data[descriptionKey];
        
        renderedItems.push(
          <View key={key} style={styles.nestedItem}>
            <View style={styles.nestedContent}>
              <View style={styles.nestedHeader}>
                <Text style={[styles.nestedLabel, { color: colors.text }]}>
                  {timelineLabels[key] || key.replace(/_/g, ' ')}:
                </Text>
                <Text style={[styles.nestedValue, { color: getImpactColor(value) }]}>
                  {value}
                </Text>
              </View>
              {description && (
                <Text style={[styles.nestedDescription, { color: colors.secondary }]}>
                  {description}
                </Text>
              )}
            </View>
          </View>
        );
      });
      
      return renderedItems.length > 0 ? renderedItems : null;
    }
    return null;
  };

  // Memoize styles for performance
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: expanded ? 16 : 0,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      backgroundColor: `${iconColor}20`,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 2,
    },
    expandIcon: {
      padding: 4,
    },
    timeline: {
      marginTop: 8,
    },
    timelineItem: {
      flexDirection: 'row',
      marginBottom: 16,
      borderLeftWidth: 2,
      paddingLeft: 16,
      marginLeft: 8,
    },
    timelineDot: {
      position: 'absolute',
      left: -6,
      top: 0,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    timelineContent: {
      flex: 1,
    },
    timelineLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    timelineImpact: {
      fontSize: 13,
      lineHeight: 18,
    },
    description: {
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
      fontStyle: 'italic',
    },
    reversibleTag: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    reversibleText: {
      fontSize: 11,
      marginLeft: 4,
    },
    research: {
      fontSize: 11,
      marginTop: 4,
      fontStyle: 'italic',
    },
    nestedItem: {
      flexDirection: 'row',
      marginLeft: 16,
      marginTop: 8,
    },
    nestedContent: {
      flex: 1,
    },
    nestedHeader: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    nestedLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginRight: 8,
      textTransform: 'capitalize',
    },
    nestedValue: {
      fontSize: 12,
      flex: 1,
      fontWeight: '500',
    },
    nestedDescription: {
      fontSize: 11,
      lineHeight: 16,
      fontStyle: 'italic',
      marginTop: 2,
    },
  }), [colors, iconColor]);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Icon name={iconName} size={24} color={iconColor} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        <Icon 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={24} 
          color={colors.secondary}
          style={styles.expandIcon}
        />
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.timeline}>
          {Object.entries(predictions)
            // Sort timeline predictions by duration (shortest to longest)
            .sort(([keyA], [keyB]) => {
              const order = ['1_week', '1_month', '3_months', '6_months', '1_year', 'continued_1_year', 'if_quit_now', 'continued_abstinence'];
              const indexA = order.indexOf(keyA);
              const indexB = order.indexOf(keyB);
              // If both keys are in the order array, sort by their position
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              // If only one is in the order array, it comes first
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              // Otherwise, maintain original order
              return 0;
            })
            .map(([key, data]) => {
              // Skip research key at this level
              if (key === 'research' || key === 'research_references') return null;
              
              // Handle nested predictions
              const nested = renderNestedPredictions(data);
              if (nested) {
                return (
                  <View key={key} style={[styles.timelineItem, { borderLeftColor: iconColor }]}>
                    <View style={styles.timelineDot}>
                      <View style={[styles.dot, { backgroundColor: iconColor }]} />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, { color: colors.text }]}>
                        {timelineLabels[key] || key.replace(/_/g, ' ')}
                      </Text>
                      {nested}
                      {data.research && (
                        <Text style={[styles.research, { color: colors.secondary }]}>
                          📚 {data.research}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              }
              
              return renderTimelineItem(key, data);
            })}
        </View>
      )}
    </View>
  );
};

export default TimelinePredictionCard;
