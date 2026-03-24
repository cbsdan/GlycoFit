import apiClient from '../config/api';

const mealService = {
  getUserMeals: async (userId, page = 1, perPage = 10) => {
    try {
      const response = await apiClient.get(`/admin/users/${userId}/meals`, {
        params: { page, per_page: perPage },
      });
      return response.data;
    } catch (error) {
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
