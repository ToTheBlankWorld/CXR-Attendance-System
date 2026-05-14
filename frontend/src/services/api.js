import axios from 'axios';

const API_BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

export const classesAPI = {
  getAll: () => api.get('/classes/'),
  getDetail: (lectureId) => api.get(`/classes/${lectureId}`),
};

export const attendanceAPI = {
  markPresent: (lectureId, name) =>
    api.post(`/attendance/${lectureId}/mark-present/${encodeURIComponent(name)}`),
  markAbsent: (lectureId, name) =>
    api.post(`/attendance/${lectureId}/mark-absent/${encodeURIComponent(name)}`),
  markExit: (lectureId, name) =>
    api.post(`/attendance/${lectureId}/mark-exit/${encodeURIComponent(name)}`),
  resetClass: (lectureId) =>
    api.post(`/attendance/${lectureId}/reset`),
  resetAllLogs: () =>
    api.delete('/attendance/reset-all'),
  getLogs: (lectureId, date) =>
    api.get('/attendance/logs', { params: { lecture_id: lectureId, date } }),
  getUnknownFaces: (lectureId, date) =>
    api.get('/attendance/unknown-faces', { params: { lecture_id: lectureId, date } }),
};

export const recognitionAPI = {
  clearEmbeddings: () => api.post('/recognition/clear-embeddings'),
  loadClass: (lectureId) => api.post(`/recognition/load-class/${lectureId}`),
  recognize: (lectureId, imageBase64, mode = 'attendance') =>
    api.post('/recognition/recognize', { lecture_id: lectureId, image: imageBase64, mode }),
  clearCooldowns: () => api.post('/recognition/clear-cooldowns'),
  stopAttendance: (lectureId) => api.post(`/recognition/stop-attendance/${lectureId}`),
  getUnknownTracking: (lectureId, date) =>
    api.get('/recognition/unknown-tracking', { params: { lecture_id: lectureId, date } }),
  getActiveUnknownCount: (lectureId) => api.get(`/recognition/active-unknown-count/${lectureId}`),
  getEnrolledStudents: () => api.get('/recognition/enrolled-students'),
};

export const enrollmentAPI = {
  enrollBase64: (name, images) =>
    api.post('/enrollment/enroll-base64', { name, images }),
  checkEnrollment: (name) => api.get(`/enrollment/check/${encodeURIComponent(name)}`),
};

export default api;
