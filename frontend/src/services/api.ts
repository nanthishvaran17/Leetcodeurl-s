import axios from 'axios';

// Smart API Base URL Resolution for Local Development vs Production Hosting
const getApiBaseUrl = () => {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (isLocal) {
    return envUrl ? `${envUrl}/api` : '/api';
  }
  
  // Production Cloud Hosting (Firebase Hosting -> Render FastAPI Backend)
  if (envUrl && !envUrl.includes('localhost')) {
    return `${envUrl}/api`;
  }
  
  return 'https://leetcodeurl-s.onrender.com/api';
};

const API_BASE = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
