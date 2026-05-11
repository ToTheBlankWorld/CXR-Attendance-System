import axios from 'axios';

const API_BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
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

// Handle 401 errors
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

// Auth API
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Classes API
export const classesAPI = {
  getAll: () => api.get('/classes/'),
  getDetail: (lectureId) => api.get(`/classes/${lectureId}`),
};

// Attendance API
export const attendanceAPI = {
  markPresent: (lectureId, regNo) =>
    api.post(`/attendance/${lectureId}/mark-present/${regNo}`),
  markAbsent: (lectureId, regNo) =>
    api.post(`/attendance/${lectureId}/mark-absent/${regNo}`),
  markExit: (lectureId, regNo) =>
    api.post(`/attendance/${lectureId}/mark-exit/${regNo}`),
  resetClass: (lectureId) =>
    api.post(`/attendance/${lectureId}/reset`),
  resetAllLogs: () =>
    api.delete('/attendance/reset-all'),
  getLogs: (lectureId, date) =>
    api.get('/attendance/logs', { params: { lecture_id: lectureId, date } }),
  getUnknownFaces: (lectureId, date) =>
    api.get('/attendance/unknown-faces', { params: { lecture_id: lectureId, date } }),
};

// Recognition API
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

// Enrollment API
export const enrollmentAPI = {
  processDataset: () => api.post('/enrollment/process-dataset'),
  enrollBase64: (regNo, name, images) =>
    api.post('/enrollment/enroll-base64', { reg_no: regNo, name, images }),
  checkEnrollment: (regNo) => api.get(`/enrollment/check/${regNo}`),
};

export default api;
