import apiClient from '../config/api';

const userService = {
  getAllUsers: async (skip = 0, limit = 50) => {
    const response = await apiClient.get(`/users?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getUserById: async (userId) => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  getUserByEmail: async (email) => {
    const response = await apiClient.get(`/users/email/${email}`);
    return response.data;
  },

  disableUser: async (userId, reason, endDate = null, isPermanent = false) => {
    const response = await apiClient.post(`/users/${userId}/disable`, {
      reason,
      end_date: endDate,
      is_permanent: isPermanent,
    });
    return response.data;
  },

  enableUser: async (userId, reason = 'User enabled') => {
    const response = await apiClient.post(`/users/${userId}/enable`, { reason });
    return response.data;
  },

  updateUserProfile: async (userId, updates) => {
    const response = await apiClient.put(`/users/${userId}`, updates);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await apiClient.delete(`/users/${userId}`);
    return response.data;
  },
};

export default userService;
