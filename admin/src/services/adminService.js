import apiClient from '../config/api';

/**
 * Admin API service — centralized calls for all admin dashboard endpoints.
 */
const adminService = {
  // ─── Dashboard ───────────────────────────────────────────────────
  getRiskDistribution: () => apiClient.get('/admin/risk/distribution').then(r => r.data),
  getTrackerAdoption: () => apiClient.get('/admin/tracker/adoption').then(r => r.data),
  getConsultationsSummary: () => apiClient.get('/admin/consultations/summary').then(r => r.data),
  getRecentActivity: (limit = 5) => apiClient.get(`/admin/recent-activity?limit=${limit}`).then(r => r.data),

  // ─── User Extended ───────────────────────────────────────────────
  getUserRiskOverview: (uid) => apiClient.get(`/admin/users/${uid}/risk-overview`).then(r => r.data),
  getUserTrackers: (uid) => apiClient.get(`/admin/users/${uid}/trackers`).then(r => r.data),
  getUserAssessment: (uid) => apiClient.get(`/admin/users/${uid}/assessment`).then(r => r.data),
  getUserActivity: (uid) => apiClient.get(`/admin/users/${uid}/activity`).then(r => r.data),
  deleteUser: (uid) => apiClient.delete(`/admin/users/${uid}/delete`).then(r => r.data),

  // ─── Physician Management ────────────────────────────────────────
  getPhysicians: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/physicians?${qs}`).then(r => r.data);
  },
  getPhysicianDetails: (id) => apiClient.get(`/admin/physicians/${id}/details`).then(r => r.data),
  getPhysicianPatients: (id) => apiClient.get(`/admin/physicians/${id}/patients`).then(r => r.data),
  getPhysicianConsultations: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/physicians/${id}/consultations?${qs}`).then(r => r.data);
  },
  getPhysicianAvailability: (id) => apiClient.get(`/admin/physicians/${id}/availability`).then(r => r.data),

  // ─── Risk & Assessments ──────────────────────────────────────────
  getRiskComponentAverages: () => apiClient.get('/admin/risk/component-averages').then(r => r.data),
  getRiskTrend: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/risk/trend?${qs}`).then(r => r.data);
  },
  getHighRiskPatients: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/risk/high-risk-patients?${qs}`).then(r => r.data);
  },
  getAssessmentStats: () => apiClient.get('/admin/assessments/stats').then(r => r.data),
  getAssessmentsList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/assessments/list?${qs}`).then(r => r.data);
  },

  // ─── Health Trackers ─────────────────────────────────────────────
  getFoodTrackerStats: () => apiClient.get('/admin/trackers/food/stats').then(r => r.data),
  getStepTrackerStats: () => apiClient.get('/admin/trackers/steps/stats').then(r => r.data),
  getSleepTrackerStats: () => apiClient.get('/admin/trackers/sleep/stats').then(r => r.data),
  getSmokingTrackerStats: () => apiClient.get('/admin/trackers/smoking/stats').then(r => r.data),
  getAlcoholTrackerStats: () => apiClient.get('/admin/trackers/alcohol/stats').then(r => r.data),

  // ─── Meals Extended ──────────────────────────────────────────────
  getMealsStats: () => apiClient.get('/admin/meals/stats').then(r => r.data),
  getMealsNutrientTrends: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/meals/nutrient-trends?${qs}`).then(r => r.data);
  },
  browseMeals: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/meals/browse?${qs}`).then(r => r.data);
  },

  // ─── Consultations & Telehealth ──────────────────────────────────
  getConsultationsList: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/consultations?${qs}`).then(r => r.data);
  },
  getConsultationDetail: (id) => apiClient.get(`/admin/consultations/${id}`).then(r => r.data),
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/appointments?${qs}`).then(r => r.data);
  },
  getPrescriptions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/prescriptions?${qs}`).then(r => r.data);
  },

  // ─── Chat & Communication ───────────────────────────────────────
  getChatStats: () => apiClient.get('/admin/chat/stats').then(r => r.data),
  getChatConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/chat/conversations?${qs}`).then(r => r.data);
  },
  getConversationMessages: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/chat/conversations/${id}/messages?${qs}`).then(r => r.data);
  },

  // ─── AI & Chatbot ───────────────────────────────────────────────
  getChatbotStats: () => apiClient.get('/admin/chatbot/stats').then(r => r.data),
  getChatbotConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/chatbot/conversations?${qs}`).then(r => r.data);
  },
  getAiFoodAnalysisStats: () => apiClient.get('/admin/ai/food-analysis-stats').then(r => r.data),

  // ─── System & Services ──────────────────────────────────────────
  getSystemHealth: () => apiClient.get('/admin/system/health').then(r => r.data),
  getDatabaseStats: () => apiClient.get('/admin/system/database-stats').then(r => r.data),
  getPlatformConfig: () => apiClient.get('/admin/system/config').then(r => r.data),
  getSystemLogs: (limit = 50) => apiClient.get(`/admin/system/logs?limit=${limit}`).then(r => r.data),
  getGeminiStatus: () => apiClient.get('/gemini/status').then(r => r.data),
};

export default adminService;
