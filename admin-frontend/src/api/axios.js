import axios from 'axios';

// Lê as credenciais do .env do Vite
const adminUser = import.meta.env.VITE_ADMIN_USER || 'admin';
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

const api = axios.create({
  auth: {
    username: adminUser,
    password: adminPassword
  }
});

export default api;
