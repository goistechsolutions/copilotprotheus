const axios = require('axios')
require('dotenv').config()

const client = axios.create({
  baseURL: process.env.BACKEND_URL || '',
  timeout: parseInt(process.env.BACKEND_TIMEOUT_MS || '600000', 10)
})

module.exports = {
  ask: async (payload, token = null) => {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      return await client.post('/api/ask', payload, { headers })
    } catch (e) {
      const status = e.response?.status || 502;
      const detail = e.response?.data?.detail || e.message;
      const error = new Error(`${status} ${detail}`);
      error.status = status;
      error.detail = detail;
      throw error;
    }
  },
  askStream: async (payload, token = null) => {
    try {
      const headers = { 
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      return await client.post('/api/ask/stream', payload, { headers, responseType: 'stream' })
    } catch (e) {
      const status = e.response?.status || 502;
      const detail = e.response?.data?.detail || e.message;
      const error = new Error(`${status} ${detail}`);
      error.status = status;
      error.detail = detail;
      throw error;
    }
  },
  getCompanyByTenant: async (tenantId, token = null) => {
    try {
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      const response = await client.get(`/api/companies/by-tenant/${tenantId}`, { headers })
      return response.data
    } catch (e) {
      throw new Error(`${e.response?.status || 'NO_STATUS'} ${e.message}`)
    }
  }
}
