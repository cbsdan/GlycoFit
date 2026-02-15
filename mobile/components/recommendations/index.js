/**
 * Lifestyle Recommendations Components
 * 
 * A collection of reusable components for displaying AI-powered
 * lifestyle recommendations based on research studies.
 * 
 * Components:
 * - TimelinePredictionCard: Shows what may happen if current patterns continue
 * - RecommendationCard: Displays actionable health recommendations
 * - HealthyDefaultsCard: Shows research-backed targets when data is insufficient
 * - LifestyleRecommendationsSection: Main container that fetches and displays all
 * 
 * Usage:
 * ```jsx
 * import { LifestyleRecommendationsSection } from '../components/recommendations';
 * 
 * // In your tracker screen:
 * <LifestyleRecommendationsSection 
 *   trackerType="food"  // or 'sleep', 'activity', 'alcohol', 'smoking'
 *   onError={(err) => console.log(err)}
 * />
 * ```
 */

import TimelinePredictionCard from './TimelinePredictionCard';
import RecommendationCard from './RecommendationCard';
import HealthyDefaultsCard from './HealthyDefaultsCard';
import LifestyleRecommendationsSection from './LifestyleRecommendationsSection';

export {
  TimelinePredictionCard,
  RecommendationCard,
  HealthyDefaultsCard,
  LifestyleRecommendationsSection,
};

export default LifestyleRecommendationsSection;
