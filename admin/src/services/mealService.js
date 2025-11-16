import apiClient from '../config/api';

const mealService = {
  getUserMeals: async (userId) => {
    try {
      console.log(`Calling API for meals: /admin/users/${userId}/meals`);
      const response = await apiClient.get(`/admin/users/${userId}/meals`);
      console.log('API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API error:', error);
      throw error.response?.data || { error: error.message };
    }
  },

  deleteMeal: async (mealId) => {
    try {
      const response = await apiClient.delete(`/admin/meals/${mealId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: error.message };
    }
  },
};

export default mealService;
