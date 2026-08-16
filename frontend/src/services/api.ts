import axios from 'axios';

// Smart API Base URL Resolution for Local Development vs Production Hosting
const getApiBaseUrl = () => {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isLocal) {
    return 'http://127.0.0.1:8000/api';
  }

  // If hosted on Render directly (same origin as backend)
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.includes('onrender.com')) {
    return `${window.location.origin}/api`;
  }

  // Production Cloud Hosting (Firebase Hosting -> Render FastAPI Backend)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  return 'https://leetcodeurl-s.onrender.com/api';
};


const API_BASE = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 35000, // 35s timeout to handle Render free-tier cold starts
  withCredentials: true,
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


export const triggerFullSync = async (triggeredBy = 'admin') => {
  const res = await api.post(`/sync/full?triggered_by=${triggeredBy}`);
  return res.data;
};

export const getSyncStatus = async () => {
  const res = await api.get('/sync/status');
  return res.data;
};

export const getSyncJobDetails = async (jobId: string) => {
  const res = await api.get(`/sync/jobs/${jobId}`);
  return res.data;
};

export const triggerSingleStudentSync = async (studentId: number) => {
  const res = await api.post(`/sync/student/${studentId}`);
  return res.data;
};

export const getDataFreshness = async () => {
  const res = await api.get('/data/freshness');
  return res.data;
};

export default api;
