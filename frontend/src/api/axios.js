import axios from 'axios';
import { API_URL } from '../utils/apiUrl';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Request interceptor – attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Drop empty filters (status="", from="") — the API validates every query value
    if (config.params) {
      config.params = Object.fromEntries(
        Object.entries(config.params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor – logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
