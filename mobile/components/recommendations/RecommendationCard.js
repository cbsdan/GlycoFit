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
 * RecommendationCard
 * 
 * Displays health recommendations based on research studies.
 * Shows actionable items the user can follow to improve their health metrics.
 * 
 * Props:
 * - recommendations: Array of recommendation objects or strings
 * - title: Card title (e.g., "Recommendations")
 * - iconName: Icon name for the header
 * - iconColor: Color for the icon
 * - riskLevel: Optional risk level (low, moderate, high) for styling
 * - research: Optional research citation
 */
const RecommendationCard = ({
  recommendations,
  title = "Recommendations",
  subtitle = "Based on your current data",
  iconName = "lightbulb-outline",
  iconColor = "#9B59B6",
  riskLevel = null,
  research = null,
  researchReferences = null,
  expanded = true,
  onToggleExpand,
  showCheckbox = false,
  onCheckItem
}) => {
  const { colors } = useTheme();

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'low':
      case 'healthy':
      case 'optimal':
        return '#27AE60';
      case 'moderate':
      case 'approaching':
        return '#F39C12';
      case 'high':
      case 'elevated':
        return '#E74C3C';
      default:
        return iconColor;
    }
  };

  const getRecommendationIcon = (recommendation) => {
    const text = typeof recommendation === 'string' ? recommendation.toLowerCase() : '';
    
    if (text.includes('walk') || text.includes('step') || text.includes('activity')) {
      return 'walk';
    }
    if (text.includes('sleep') || text.includes('bed') || text.includes('rest')) {
      return 'sleep';
    }
    if (text.includes('food') || text.includes('eat') || text.includes('diet') || text.includes('meal')) {
      return 'food-apple';
    }
    if (text.includes('water') || text.includes('hydrat')) {
      return 'water';
    }
    if (text.includes('avoid') || text.includes("don't") || text.includes('limit')) {
      return 'close-circle-outline';
    }
    if (text.includes('increase') || text.includes('add') || text.includes('more')) {
      return 'plus-circle-outline';
    }
    if (text.includes('reduce') || text.includes('decrease') || text.includes('less')) {
      return 'minus-circle-outline';
    }
    if (text.includes('track') || text.includes('monitor') || text.includes('log')) {
      return 'chart-line';
    }
    if (text.includes('quit') || text.includes('stop') || text.includes('cessation')) {
      return 'stop-circle-outline';
    }
    return 'check-circle-outline';
  };

  const renderRecommendation = (item, index) => {
    // Handle string recommendations
    if (typeof item === 'string') {
      return (
        <TouchableOpacity 
          key={index} 
          style={styles.recommendationItem}
          onPress={() => showCheckbox && onCheckItem && onCheckItem(index)}
          activeOpacity={showCheckbox ? 0.7 : 1}
          disabled={!showCheckbox}
        >
          <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}20` }]}>
            <Icon 
              name={showCheckbox ? 'check-circle' : getRecommendationIcon(item)} 
              size={20} 
              color={iconColor} 
            />
          </View>
          <View style={styles.recommendationContent}>
            <Text style={[styles.recommendationText, { color: colors.text }]}>
              {item}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Handle object recommendations with enhanced structure
    const title = item.title;
    const message = item.message;
    const text = item.text || item.recommendation;
    const priority = item.priority;
    const category = item.category;
    const checked = item.checked || false;
    const actionableTips = item.actionable_tips || item.actionableTips;
    const protectiveEffect = item.protective_effect || item.protectiveEffect;
    const maintenanceTips = item.maintenance_tips || item.maintenanceTips;
    const progressiveGoals = item.progressive_goals || item.progressiveGoals;

    // Determine the main text to display
    const displayText = text || message || title;
    
    const priorityColors = {
      critical: '#C0392B',
      high: '#E74C3C',
      medium: '#F39C12',
      low: '#27AE60'
    };

    return (
      <View key={index} style={styles.recommendationItem}>
        <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}20` }]}>
          <Icon 
            name={showCheckbox && checked ? 'check-circle' : getRecommendationIcon(displayText)} 
            size={20} 
            color={showCheckbox && checked ? '#27AE60' : iconColor} 
          />
        </View>
        <View style={styles.recommendationContent}>
          {category && (
            <Text style={[styles.category, { color: colors.secondary }]}>
              {category}
            </Text>
          )}
          {title && (
            <Text style={[styles.recommendationTitle, { color: colors.text }]}>
              {title}
            </Text>
          )}
          {message && (
            <Text style={[
              styles.recommendationText, 
              { color: colors.text },
              checked && styles.checkedText
            ]}>
              {message}
            </Text>
          )}
          {!title && !message && displayText && (
            <Text style={[
              styles.recommendationText, 
              { color: colors.text },
              checked && styles.checkedText
            ]}>
              {displayText}
            </Text>
          )}
          {priority && (
            <View style={[styles.priorityTag, { backgroundColor: `${priorityColors[priority]}20` }]}>
              <Text style={[styles.priorityText, { color: priorityColors[priority] }]}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
              </Text>
            </View>
          )}
          {protectiveEffect && (
            <View style={styles.detailSection}>
              <Icon name="shield-check" size={14} color="#27AE60" style={styles.detailIcon} />
              <Text style={[styles.detailText, { color: '#27AE60' }]}>
                {protectiveEffect}
              </Text>
            </View>
          )}
          {actionableTips && actionableTips.length > 0 && (
            <View style={styles.tipsSection}>
              <Text style={[styles.tipsTitle, { color: colors.secondary }]}>
                💡 Action Steps:
              </Text>
              {actionableTips.map((tip, tipIndex) => (
                <View key={tipIndex} style={styles.tipItem}>
                  <Text style={[styles.tipBullet, { color: iconColor }]}>•</Text>
                  <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
          {maintenanceTips && maintenanceTips.length > 0 && (
            <View style={styles.tipsSection}>
              <Text style={[styles.tipsTitle, { color: colors.secondary }]}>
                ✓ Maintenance Tips:
              </Text>
              {maintenanceTips.map((tip, tipIndex) => (
                <View key={tipIndex} style={styles.tipItem}>
                  <Text style={[styles.tipBullet, { color: iconColor }]}>•</Text>
                  <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
          {progressiveGoals && (
            <View style={styles.tipsSection}>
              <Text style={[styles.tipsTitle, { color: colors.secondary }]}>
                📈 Progressive Goals:
              </Text>
              {Object.entries(progressiveGoals).map(([timeframe, goal], goalIndex) => (
                <View key={goalIndex} style={styles.tipItem}>
                  <Text style={[styles.goalTimeframe, { color: iconColor }]}>
                    {timeframe.replace(/_/g, ' ')}:
                  </Text>
                  <Text style={[styles.tipText, { color: colors.text }]}> {goal}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const riskColor = getRiskColor(riskLevel);

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
    riskBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    riskText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    expandIcon: {
      padding: 4,
    },
    recommendationsList: {
      marginTop: 8,
    },
    recommendationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: `${colors.border}50`,
    },
    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    recommendationContent: {
      flex: 1,
    },
    category: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    recommendationTitle: {
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 20,
      marginBottom: 4,
    },
    recommendationText: {
      fontSize: 14,
      lineHeight: 20,
    },
    checkedText: {
      textDecorationLine: 'line-through',
      opacity: 0.6,
    },
    priorityTag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      marginTop: 6,
    },
    priorityText: {
      fontSize: 10,
      fontWeight: '600',
    },
    detailSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: '#27AE6015',
      borderRadius: 8,
    },
    detailIcon: {
      marginRight: 6,
    },
    detailText: {
      fontSize: 12,
      flex: 1,
      fontWeight: '500',
    },
    tipsSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: `${colors.border}50`,
    },
    tipsTitle: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
    },
    tipItem: {
      flexDirection: 'row',
      marginBottom: 6,
      paddingLeft: 8,
    },
    tipBullet: {
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
      lineHeight: 20,
    },
    tipText: {
      fontSize: 13,
      flex: 1,
      lineHeight: 20,
    },
    goalTimeframe: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    researchSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    researchTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondary,
      marginBottom: 8,
    },
    researchText: {
      fontSize: 11,
      color: colors.secondary,
      fontStyle: 'italic',
      lineHeight: 16,
      marginBottom: 4,
    },
  }), [colors, iconColor]);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={onToggleExpand}
        activeOpacity={onToggleExpand ? 0.7 : 1}
        disabled={!onToggleExpand}
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
        {riskLevel && (
          <View style={[styles.riskBadge, { backgroundColor: `${riskColor}20` }]}>
            <Text style={[styles.riskText, { color: riskColor }]}>
              {riskLevel}
            </Text>
          </View>
        )}
        {onToggleExpand && (
          <Icon 
            name={expanded ? "chevron-up" : "chevron-down"} 
            size={24} 
            color={colors.secondary}
            style={styles.expandIcon}
          />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.recommendationsList}>
          {Array.isArray(recommendations) 
            ? recommendations.map((item, index) => renderRecommendation(item, index))
            : typeof recommendations === 'object'
              ? Object.entries(recommendations).map(([key, value], index) => 
                  renderRecommendation(typeof value === 'string' ? value : { category: key, ...value }, index)
                )
              : renderRecommendation(recommendations, 0)
          }
          
          {/* {(research || researchReferences) && (
            <View style={styles.researchSection}>
              <Text style={styles.researchTitle}>📚 Research References</Text>
              {research && (
                <Text style={styles.researchText}>• {research}</Text>
              )}
              {researchReferences && Array.isArray(researchReferences) && 
                researchReferences.map((ref, idx) => (
                  <Text key={idx} style={styles.researchText}>• {ref}</Text>
                ))
              }
            </View>
          )} */}
        </View>
      )}
    </View>
  );
};

export default RecommendationCard;
