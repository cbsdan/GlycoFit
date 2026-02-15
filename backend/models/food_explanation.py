"""
Food Risk Assessment Explanations and Educational Content
Provides detailed, personalized explanations for risk scores and recommendations
"""

class FoodExplanation:
    """
    Provides research-based explanations and educational content
    for food risk assessment components
    """
    
    # Baseline question explanations with research context
    BASELINE_EXPLANATIONS = {
        'daily_meal_frequency': {
            'why_it_matters': 'Meal frequency affects your metabolism and blood sugar regulation.',
            'optimal': '3-4 balanced meals per day',
            'risk_explanation': {
                'low': 'Regular meal patterns help maintain stable blood sugar levels.',
                'high': 'Very frequent eating or skipping meals disrupts metabolic regulation.'
            },
            'research': 'Studies show irregular meal patterns increase diabetes risk by disrupting circadian rhythm and insulin sensitivity (Paoli et al., 2019).',
            'actionable_tip': 'Aim for 3-4 balanced meals daily with consistent timing.'
        },
        'skip_breakfast': {
            'why_it_matters': 'Breakfast kickstarts your metabolism and regulates hunger hormones throughout the day.',
            'optimal': 'Eating breakfast daily',
            'risk_explanation': {
                'low': 'Regular breakfast consumption supports healthy metabolism.',
                'high': 'Skipping breakfast regularly increases diabetes risk by 21% due to compensatory overeating and metabolic disruption.'
            },
            'research': 'Research shows breakfast skippers have higher HbA1c levels and insulin resistance (Ballon et al., 2019).',
            'actionable_tip': 'Start your day with a balanced breakfast containing protein, fiber, and healthy fats within 2 hours of waking.'
        },
        'late_night_eating': {
            'why_it_matters': 'Your body\'s ability to process food decreases in the evening, especially near bedtime.',
            'optimal': 'Finishing meals 2-3 hours before bed',
            'risk_explanation': {
                'low': 'Avoiding late-night eating supports healthy circadian rhythm and metabolism.',
                'high': 'Late-night eating disrupts insulin sensitivity and glucose tolerance, increasing diabetes risk.'
            },
            'research': 'Evening eating within 2 hours of bedtime impairs glucose metabolism and reduces next-day insulin sensitivity (Yoshida et al., 2018).',
            'actionable_tip': 'Complete your last meal at least 2-3 hours before bedtime to optimize metabolic health.'
        },
        'sugary_drinks_frequency': {
            'why_it_matters': 'Sugary drinks cause rapid blood sugar spikes without providing satiety, leading to overconsumption.',
            'optimal': 'Avoiding sugary beverages entirely',
            'risk_explanation': {
                'low': 'Avoiding sugary drinks significantly reduces diabetes risk.',
                'high': 'Each daily serving of sugar-sweetened beverages increases diabetes risk by 13-26%.'
            },
            'research': 'Meta-analysis of 310,819 participants found strong association between sugary drink consumption and type 2 diabetes (Imamura et al., 2015).',
            'actionable_tip': 'Replace sugary drinks with water, unsweetened tea, or sparkling water with lemon.'
        },
        'processed_food_frequency': {
            'why_it_matters': 'Processed foods are typically high in refined carbs, unhealthy fats, and additives while being low in fiber and nutrients.',
            'optimal': 'Limiting processed foods to occasional consumption',
            'risk_explanation': {
                'low': 'Limiting processed foods reduces exposure to refined carbs and unhealthy fats.',
                'high': 'Ultra-processed foods increase diabetes risk by 15% per daily serving.'
            },
            'research': 'Large cohort studies show clear dose-response relationship between ultra-processed food consumption and diabetes incidence (Srour et al., 2020).',
            'actionable_tip': 'Choose whole, minimally processed foods. When buying packaged foods, read labels and limit items with >5 ingredients.'
        },
        'whole_grains_intake': {
            'why_it_matters': 'Whole grains contain fiber, vitamins, minerals, and phytochemicals that improve insulin sensitivity.',
            'optimal': 'Daily whole grain consumption (3+ servings)',
            'risk_explanation': {
                'low': 'Rare whole grain consumption misses important protective benefits.',
                'high': 'Regular whole grain intake reduces diabetes risk by 20-30%.'
            },
            'research': 'Meta-analysis found 3 servings/day of whole grains associated with 32% lower diabetes risk (Aune et al., 2013).',
            'actionable_tip': 'Replace refined grains with whole wheat bread, brown rice, quinoa, oats, and barley.'
        },
        'vegetable_servings': {
            'why_it_matters': 'Vegetables provide fiber, antioxidants, and micronutrients that support healthy blood sugar regulation.',
            'optimal': '5+ servings per day (2.5 cups)',
            'risk_explanation': {
                'low': 'Low vegetable intake means missing critical protective nutrients.',
                'high': '5+ daily servings associated with significantly reduced diabetes risk.'
            },
            'research': 'Green leafy vegetables and cruciferous vegetables show strongest protective effects (Carter et al., 2010).',
            'actionable_tip': 'Fill half your plate with non-starchy vegetables at each meal. Aim for variety in colors.'
        },
        'fruit_servings': {
            'why_it_matters': 'Whole fruits provide fiber and nutrients, though in moderation due to natural sugar content.',
            'optimal': '2-3 servings per day, preferring whole fruits over juice',
            'risk_explanation': {
                'low': 'Very low fruit intake misses protective benefits.',
                'high': 'Moderate whole fruit consumption (2-3 servings) is beneficial, but excessive intake may increase sugar consumption.'
            },
            'research': 'Berries, grapes, and apples show strongest protective effects. Fruit juice increases risk (Muraki et al., 2013).',
            'actionable_tip': 'Choose whole fruits (especially berries) over fruit juice. Limit to 2-3 servings daily as part of balanced meals.'
        },
        'red_meat_frequency': {
            'why_it_matters': 'Red meat, especially processed varieties, contains heme iron and saturated fat that may impair insulin function.',
            'optimal': 'Limiting to 1-2 servings per week',
            'risk_explanation': {
                'low': 'Minimal red meat consumption reduces diabetes risk.',
                'high': 'Daily red meat consumption, especially processed meats, significantly increases diabetes risk.'
            },
            'research': 'Each daily serving of red meat increases diabetes risk by 19% (processed: 51%) (Pan et al., 2011).',
            'actionable_tip': 'Choose fish, poultry, legumes, or plant proteins instead. When eating red meat, choose lean, unprocessed cuts.'
        },
        'fried_food_frequency': {
            'why_it_matters': 'Fried foods contain harmful trans fats and advanced glycation end products (AGEs) that promote inflammation.',
            'optimal': 'Rare or occasional consumption',
            'risk_explanation': {
                'low': 'Avoiding fried foods reduces exposure to harmful fats and inflammatory compounds.',
                'high': 'Frequent fried food consumption increases diabetes risk through inflammation and insulin resistance.'
            },
            'research': 'Fried food consumption associated with increased diabetes risk in dose-dependent manner (Cahill et al., 2014).',
            'actionable_tip': 'Use baking, grilling, steaming, or air-frying instead of deep frying. Limit restaurant fried foods.'
        },
        'snacking_frequency': {
            'why_it_matters': 'Constant snacking keeps insulin levels elevated and may reduce insulin sensitivity over time.',
            'optimal': '0-2 planned, healthy snacks per day',
            'risk_explanation': {
                'low': 'Moderate, planned snacking supports stable energy.',
                'high': 'Excessive snacking (4+ times daily) may impair insulin sensitivity and promote weight gain.'
            },
            'research': 'Frequent eating occasions associated with higher diabetes risk independent of total calorie intake.',
            'actionable_tip': 'Limit to 1-2 planned snacks daily. Choose protein/fiber-rich options like nuts, Greek yogurt, or vegetables.'
        },
        'portion_size_awareness': {
            'why_it_matters': 'Large portions lead to excess calorie intake, weight gain, and increased metabolic stress.',
            'optimal': 'Moderate, appropriate portions',
            'risk_explanation': {
                'low': 'Appropriate portion sizes support healthy weight and metabolism.',
                'high': 'Consistently large portions increase risk through excess calorie intake and weight gain.'
            },
            'research': 'Larger portion sizes directly linked to higher calorie intake and obesity risk, major diabetes risk factors.',
            'actionable_tip': 'Use smaller plates, measure portions initially, and stop eating when 80% full (hara hachi bu principle).'
        },
        'fiber_rich_foods': {
            'why_it_matters': 'Fiber slows glucose absorption, feeds beneficial gut bacteria, and improves insulin sensitivity.',
            'optimal': 'Daily consumption of legumes, beans, lentils',
            'risk_explanation': {
                'low': 'Low fiber intake from legumes increases diabetes risk.',
                'high': 'Regular legume consumption provides strong protection against diabetes (25g+ fiber daily).'
            },
            'research': 'Each 10g/day increase in fiber intake reduces diabetes risk by 9% (Yao et al., 2014).',
            'actionable_tip': 'Include beans, lentils, chickpeas, or split peas in meals 4-5 times weekly. Add to soups, salads, and sides.'
        },
        'refined_carbs_frequency': {
            'why_it_matters': 'Refined carbs lack fiber and cause rapid blood sugar spikes, stressing your pancreas.',
            'optimal': 'Minimizing refined carbohydrates',
            'risk_explanation': {
                'low': 'Limiting refined carbs reduces glucose spikes and insulin demand.',
                'high': 'Daily consumption of refined carbs significantly increases diabetes risk through repeated glucose spikes.'
            },
            'research': 'Refined grain consumption associated with 27% higher diabetes risk vs. whole grains (Sun et al., 2010).',
            'actionable_tip': 'Replace white bread, white rice, and pastries with whole grain alternatives. Read labels for "whole" as first ingredient.'
        },
        'water_intake': {
            'why_it_matters': 'Adequate hydration supports kidney function, helps regulate blood sugar, and reduces sugary drink consumption.',
            'optimal': '8+ glasses (64+ oz) per day',
            'risk_explanation': {
                'low': 'Inadequate water intake may lead to higher consumption of sugary alternatives.',
                'high': 'Good hydration supports metabolic health and reduces reliance on sugary beverages.'
            },
            'research': 'Higher water intake associated with lower diabetes risk, partly by displacing sugary beverages.',
            'actionable_tip': 'Drink a glass of water with each meal and keep water bottle accessible throughout the day.'
        },
        'eating_speed': {
            'why_it_matters': 'Eating quickly bypasses satiety signals, leading to overconsumption and poor glucose regulation.',
            'optimal': 'Eating slowly and mindfully (20+ minutes per meal)',
            'risk_explanation': {
                'low': 'Slow eating allows proper satiety signaling and improves glucose response.',
                'high': 'Fast eating increases diabetes risk by 2.5x compared to slow eating.'
            },
            'research': 'Fast eaters have higher insulin resistance and are more likely to develop metabolic syndrome (Ohkuma et al., 2015).',
            'actionable_tip': 'Chew thoroughly (20-30 times per bite), put utensils down between bites, and aim for 20+ minutes per meal.'
        }
    }
    
    # Nutrient-specific explanations for daily log analysis
    NUTRIENT_EXPLANATIONS = {
        'calories': {
            'name': 'Calorie Intake',
            'why_it_matters': 'Total calorie balance affects weight, which is the strongest modifiable diabetes risk factor.',
            'optimal_range': '1800-2200 calories/day (varies by individual)',
            'unit': 'kcal',
            'interpretation': {
                'too_low': 'Very low calorie intake can slow metabolism and is unsustainable.',
                'optimal': 'Your calorie intake is within healthy range.',
                'too_high': 'Excess calories lead to weight gain, increasing diabetes risk.'
            }
        },
        'added_sugars': {
            'name': 'Added Sugars',
            'why_it_matters': 'Added sugars cause rapid blood sugar spikes and insulin surges, directly increasing diabetes risk.',
            'optimal_range': '<25g per day (WHO recommendation)',
            'unit': 'g',
            'interpretation': {
                'optimal': 'You\'re keeping added sugar intake low - excellent!',
                'moderate': 'Your sugar intake is elevated. Reducing by 10g/day would significantly lower risk.',
                'high': 'High added sugar intake is a major diabetes risk factor. Each 25g/day increases risk by 18%.'
            },
            'common_sources': ['Soda', 'Sweetened coffee/tea', 'Candy', 'Baked goods', 'Sweetened yogurt'],
            'quick_wins': 'Replace one sugary drink daily with water = -40g sugar/day'
        },
        'fiber': {
            'name': 'Fiber',
            'why_it_matters': 'Fiber slows sugar absorption, feeds healthy gut bacteria, and improves insulin sensitivity.',
            'optimal_range': '25-35g per day',
            'unit': 'g',
            'interpretation': {
                'low': 'Low fiber intake increases diabetes risk. Each 10g increase reduces risk by 9%.',
                'optimal': 'Great fiber intake! This provides strong protection against diabetes.',
                'high': 'Excellent fiber intake - keep it up!'
            },
            'top_sources': ['Beans/lentils (15g per cup)', 'Raspberries (8g per cup)', 'Oats (4g per half cup)', 'Chia seeds (10g per 2 tbsp)'],
            'quick_wins': 'Add 1 cup of beans to meals = +15g fiber/day'
        },
        'glycemic_load': {
            'name': 'Glycemic Load',
            'why_it_matters': 'GL measures how much your meals spike blood sugar. High GL stresses your pancreas.',
            'optimal_range': '<100 per day',
            'unit': 'GL units',
            'interpretation': {
                'low': 'Low glycemic load - your meals cause minimal blood sugar spikes.',
                'moderate': 'Moderate GL. Focus on lower-GI carbs to reduce.',
                'high': 'High GL indicates frequent blood sugar spikes. Chronic high GL damages insulin-producing cells.'
            },
            'tips': [
                'Pair carbs with protein/fat',
                'Choose whole grains over refined',
                'Add vinegar to meals (lowers GI by 20%)',
                'Eat vegetables first'
            ]
        },
        'saturated_fat': {
            'name': 'Saturated Fat',
            'why_it_matters': 'High saturated fat intake impairs insulin signaling at the cellular level.',
            'optimal_range': '<20g per day (<7% of calories)',
            'unit': 'g',
            'interpretation': {
                'optimal': 'Saturated fat intake is well-controlled.',
                'elevated': 'Consider reducing saturated fat by choosing lean proteins.',
                'high': 'High saturated fat increases insulin resistance. Reduce red meat and full-fat dairy.'
            },
            'swap_ideas': [
                'Butter → Olive oil',
                'Beef → Chicken breast or fish',
                'Whole milk → Low-fat milk or almond milk',
                'Cheese → Nuts/seeds'
            ]
        },
        'protein': {
            'name': 'Protein',
            'why_it_matters': 'Adequate protein supports muscle health and satiety. Quality and quantity both matter.',
            'optimal_range': '50-175g per day (15-25% of calories)',
            'unit': 'g',
            'interpretation': {
                'low': 'Low protein may lead to muscle loss and reduced satiety.',
                'optimal': 'Protein intake is well-balanced.',
                'high': 'Very high protein intake - ensure variety in protein sources.'
            },
            'best_sources': ['Fish (omega-3 rich)', 'Poultry', 'Legumes', 'Greek yogurt', 'Tofu/tempeh']
        },
        'carbs': {
            'name': 'Carbohydrates',
            'why_it_matters': 'Carb quality matters more than quantity. Focus on complex, fiber-rich carbs.',
            'optimal_range': '<250g per day (varies by individual)',
            'unit': 'g',
            'interpretation': {
                'optimal': 'Carb intake is reasonable. Focus on quality (whole grains, vegetables).',
                'elevated': 'Consider shifting some carbs to vegetables and legumes.',
                'high': 'High carb intake - ensure most come from whole grains, vegetables, and legumes.'
            }
        },
        'sodium': {
            'name': 'Sodium',
            'why_it_matters': 'High sodium increases blood pressure, which worsens diabetes complications.',
            'optimal_range': '<2300mg per day',
            'unit': 'mg',
            'interpretation': {
                'optimal': 'Sodium intake is well-controlled.',
                'elevated': 'Sodium is elevated. Reduce processed foods and restaurant meals.',
                'high': 'High sodium increases cardiovascular risk. Cook at home more and use herbs/spices instead of salt.'
            }
        }
    }
    
    @staticmethod
    def get_baseline_question_explanation(question_key, user_response, risk_contribution):
        """
        Get personalized explanation for a baseline question response
        
        Args:
            question_key: Question identifier
            user_response: User's answer
            risk_contribution: How much this response contributes to overall risk (0-100)
            
        Returns:
            Dict with explanation, impact level, and recommendations
        """
        if question_key not in FoodExplanation.BASELINE_EXPLANATIONS:
            return None
        
        exp = FoodExplanation.BASELINE_EXPLANATIONS[question_key]
        
        # Determine impact level
        if risk_contribution < 3:
            impact_level = 'low'
            impact_color = 'green'
        elif risk_contribution < 7:
            impact_level = 'moderate'
            impact_color = 'yellow'
        else:
            impact_level = 'high'
            impact_color = 'red'
        
        # Get risk-specific explanation
        risk_text = exp['risk_explanation'].get('high' if risk_contribution > 5 else 'low', '')
        
        return {
            'question_key': question_key,
            'user_response': user_response,
            'risk_contribution': round(risk_contribution, 1),
            'impact_level': impact_level,
            'impact_color': impact_color,
            'why_it_matters': exp['why_it_matters'],
            'optimal': exp['optimal'],
            'risk_explanation': risk_text,
            'research': exp['research'],
            'actionable_tip': exp['actionable_tip']
        }
    
    @staticmethod
    def get_nutrient_explanation(nutrient_key, daily_average, threshold_status):
        """
        Get personalized explanation for a nutrient's daily average
        
        Args:
            nutrient_key: Nutrient identifier
            daily_average: User's daily average intake
            threshold_status: 'low', 'optimal', 'high', etc.
            
        Returns:
            Dict with explanation and recommendations
        """
        if nutrient_key not in FoodExplanation.NUTRIENT_EXPLANATIONS:
            return None
        
        exp = FoodExplanation.NUTRIENT_EXPLANATIONS[nutrient_key]
        
        interpretation = exp.get('interpretation', {}).get(threshold_status, 'Monitor this nutrient.')
        
        result = {
            'nutrient': exp['name'],
            'current_intake': daily_average,
            'optimal_range': exp['optimal_range'],
            'unit': exp['unit'],
            'status': threshold_status,
            'why_it_matters': exp['why_it_matters'],
            'interpretation': interpretation
        }
        
        # Add additional helpful info if available
        if 'common_sources' in exp:
            result['common_sources'] = exp['common_sources']
        if 'quick_wins' in exp:
            result['quick_wins'] = exp['quick_wins']
        if 'top_sources' in exp:
            result['top_sources'] = exp['top_sources']
        if 'swap_ideas' in exp:
            result['swap_ideas'] = exp['swap_ideas']
        if 'tips' in exp:
            result['tips'] = exp['tips']
        
        return result
    
    @staticmethod
    def get_risk_category_explanation(risk_score):
        """Get detailed explanation for overall risk category"""
        if risk_score < 25:
            return {
                'category': 'Low Risk',
                'color': 'green',
                'icon': '✓',
                'message': 'Your eating habits show low risk for prediabetes',
                'detailed_explanation': 'Your dietary patterns align well with research-backed recommendations for diabetes prevention. Continue your healthy habits!',
                'focus_areas': 'Maintain your current healthy eating patterns. Stay vigilant about portion sizes and continue prioritizing whole foods.',
                'prognosis': 'With continued healthy habits, your risk remains low.'
            }
        elif risk_score < 50:
            return {
                'category': 'Moderate Risk',
                'color': 'yellow',
                'icon': '⚠',
                'message': 'Your eating habits show moderate risk - improvements recommended',
                'detailed_explanation': 'Some aspects of your diet increase diabetes risk. The good news: dietary changes can significantly reduce your risk.',
                'focus_areas': 'Focus on the high-priority recommendations below. Small consistent changes yield big results.',
                'prognosis': 'With dietary improvements, you can reduce your risk to low within 3-6 months.'
            }
        elif risk_score < 75:
            return {
                'category': 'High Risk',
                'color': 'orange',
                'icon': '⚠⚠',
                'message': 'Your eating habits show high risk - significant changes needed',
                'detailed_explanation': 'Multiple dietary factors are significantly increasing your diabetes risk. This is serious but changeable.',
                'focus_areas': 'Address high-priority issues immediately. Consider working with a registered dietitian.',
                'prognosis': 'Dietary changes can reduce risk by 40-60% within 6 months. Start with top 3 recommendations.'
            }
        else:
            return {
                'category': 'Very High Risk',
                'color': 'red',
                'icon': '🚨',
                'message': 'Your eating habits show very high risk - urgent action required',
                'detailed_explanation': 'Your current dietary patterns significantly increase diabetes risk. Immediate comprehensive changes are critical.',
                'focus_areas': 'Prioritize all high-priority recommendations. Consult with healthcare provider and registered dietitian.',
                'prognosis': 'Intensive dietary intervention can reduce risk substantially. Professional guidance recommended.'
            }
