import axios from 'axios';

const api = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export { api, api as axios };
export default api;
