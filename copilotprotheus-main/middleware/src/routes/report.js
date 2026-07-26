const router = require('express').Router()
const axios = require('axios')
const logger = require('../logger')

const BACKEND_URL = process.env.BACKEND_URL || ''

// Proxy para geração de relatório
router.post('/generate', async (req, res) => {
  const token = req.headers.authorization
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = token
    }
    const response = await axios.post(`${BACKEND_URL}/api/report/generate`, req.body, { headers })
    res.json(response.data)
  } catch (e) {
    logger.error(`POST /report/generate err=${e.message}`)
    res.status(e.response?.status || 502).json({ error: e.response?.data?.detail || e.message })
  }
})

// Proxy para exportar markdown
router.post('/export-markdown', async (req, res) => {
  const token = req.headers.authorization
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = token
    }
    const response = await axios.post(`${BACKEND_URL}/api/report/export-markdown`, req.body, { headers })
    res.json(response.data)
  } catch (e) {
    logger.error(`POST /report/export-markdown err=${e.message}`)
    res.status(e.response?.status || 502).json({ error: e.response?.data?.detail || e.message })
  }
})

// Proxy para download de relatório (retorna stream binário)
router.get('/download/:filename', async (req, res) => {
  const token = req.headers.authorization
  const { filename } = req.params

  try {
    const headers = {}
    if (token) {
      headers['Authorization'] = token
    }

    const response = await axios.get(`${BACKEND_URL}/api/report/download/${filename}`, {
      headers,
      responseType: 'stream'
    })

    // Repassa os headers relevantes (Content-Type e Content-Disposition)
    res.setHeader('Content-Type', response.headers['content-type'])
    res.setHeader('Content-Disposition', response.headers['content-disposition'])

    response.data.pipe(res)
  } catch (e) {
    logger.error(`GET /report/download/${filename} err=${e.message}`)
    res.status(e.response?.status || 502).json({ error: e.message })
  }
})

module.exports = router
