import axios from 'axios';

// Configure axios defaults
// No base URL needed since we're using Vite's proxy

// Create axios instance with base configuration
const api = axios.create({
  timeout: 30000, // 30 second timeout
  withCredentials: true,
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Get token from auth store (will be set by the auth store interceptors)
    const token = axios.defaults.headers.common['Authorization'];
    if (token) {
      config.headers.Authorization = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// The response interceptor will be handled by the auth store's axios interceptors
// since we're using the same token management system

export default api;