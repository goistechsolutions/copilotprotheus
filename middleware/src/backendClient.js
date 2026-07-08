const axios = require('axios')
require('dotenv').config()

const client = axios.create({
  baseURL: process.env.BACKEND_URL || 'http://127.0.0.1:8000',
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
      throw new Error(`${e.response?.status || 'NO_STATUS'} ${e.message}`)
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
      throw new Error(`${e.response?.status || 'NO_STATUS'} ${e.message}`)
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
