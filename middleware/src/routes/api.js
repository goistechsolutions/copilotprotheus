const router = require('express').Router()
const axios = require('axios')
const backendUrl = process.env.BACKEND_URL || ''

const proxy = async (req, res, path, method = 'get') => {
  try {
    const url = `${backendUrl}/api${path}`
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['x-admin-key'] ? { 'X-Admin-Key': req.headers['x-admin-key'] } : {})
      },
      ...(method !== 'get' && method !== 'delete' ? { data: req.body } : {})
    }
    const response = await axios(config)
    res.status(response.status).json(response.data)
  } catch (e) {
    const status = e.response?.status || 502
    const detail = e.response?.data || e.message
    res.status(status).json(detail)
  }
}

router.get('/companies', (req, res) => proxy(req, res, '/companies'))
router.get('/companies/:id', (req, res) => proxy(req, res, `/companies/${req.params.id}`))
router.post('/companies', (req, res) => proxy(req, res, '/companies', 'post'))
router.put('/companies/:id', (req, res) => proxy(req, res, `/companies/${req.params.id}`, 'put'))
router.delete('/companies/:id', (req, res) => proxy(req, res, `/companies/${req.params.id}`, 'delete'))

router.get('/tenants', (req, res) => proxy(req, res, '/tenants'))
router.get('/tenants/:id', (req, res) => proxy(req, res, `/tenants/${req.params.id}`))
router.post('/tenants', (req, res) => proxy(req, res, '/tenants', 'post'))
router.put('/tenants/:id', (req, res) => proxy(req, res, `/tenants/${req.params.id}`, 'put'))
router.delete('/tenants/:id', (req, res) => proxy(req, res, `/tenants/${req.params.id}`, 'delete'))
router.post('/license/generate', (req, res) => proxy(req, res, '/license/generate', 'post'))
router.post('/license/verify', (req, res) => proxy(req, res, '/license/verify', 'post'))
router.post('/auth/validate-session', (req, res) => proxy(req, res, '/auth/validate-session', 'post'))

router.all('/*', (req, res) => {
  const path = req.path
  const method = req.method.toLowerCase()
  proxy(req, res, path, method)
})

module.exports = router
