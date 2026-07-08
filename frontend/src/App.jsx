import React from 'react'
import AssistantWidget from './AssistantWidget'
import AdminDashboard from './AdminDashboard'

function getParam(key, fallback = null) {
  return new URLSearchParams(window.location.search).get(key) || fallback
}

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminDashboard />
  }

  const context = {
    environment: getParam('environment', 'validacao'),
    company:     getParam('company',     '01'),
    branch:      getParam('branch',      '0101'),
    module:      getParam('module',      'SIGAFAT'),
    user:        getParam('user',        'admin'),
    station:     getParam('station',     'WEB01'),
    session_id:  getParam('session_id',  `w-${Date.now()}`),
    pedido:      getParam('pedido',      null),
    cliente:     getParam('cliente',     null),
    produto:     getParam('produto',     null),
    fornecedor:  getParam('fornecedor',  null),
    tenant_id:   getParam('tenant_id',   null),
  }
  return <AssistantWidget context={context} />
}
