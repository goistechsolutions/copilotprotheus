import axios from 'axios';

// Lê as credenciais do .env do Vite
const adminUser = import.meta.env.VITE_ADMIN_USER || 'admin';
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

const api = axios.create({
  baseURL,
  auth: {
    username: adminUser,
    password: adminPassword
  }
});

export default api;
