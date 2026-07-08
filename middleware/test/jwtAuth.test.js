const test = require('node:test');
const assert = require('node:assert');
const { generateToken, jwtAuth } = require('../src/jwtAuth');

test('Testes de Autenticação JWT (Middleware)', async (t) => {
  
  await t.test('Deve gerar um token assinado não vazio', () => {
    const token = generateToken({ user: 'murilo', tenant_id: 'test_tenant' });
    assert.ok(token);
    assert.strictEqual(typeof token, 'string');
  });

  await t.test('Deve validar token correto e chamar next()', () => {
    const payload = { user: 'murilo', tenant_id: 'test_tenant' };
    const token = generateToken(payload);

    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    jwtAuth(req, res, next);

    assert.ok(nextCalled);
    assert.ok(req.jwtPayload);
    assert.strictEqual(req.jwtPayload.user, 'murilo');
    assert.strictEqual(req.jwtPayload.tenant_id, 'test_tenant');
  });

  await t.test('Deve rejeitar token inválido com 401', () => {
    const req = {
      headers: {
        authorization: 'Bearer token-invalido-123'
      }
    };
    
    let statusCode = null;
    let jsonResponse = null;
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(obj) {
            jsonResponse = obj;
          }
        };
      }
    };
    const next = () => { throw new Error('Não deveria chamar next()'); };

    jwtAuth(req, res, next);

    assert.strictEqual(statusCode, 401);
    assert.ok(jsonResponse.error.includes('Token inválido'));
  });

  await t.test('Deve rejeitar cabeçalho de autorização ausente com 401', () => {
    const req = {
      headers: {}
    };
    
    let statusCode = null;
    let jsonResponse = null;
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(obj) {
            jsonResponse = obj;
          }
        };
      }
    };
    const next = () => { throw new Error('Não deveria chamar next()'); };

    jwtAuth(req, res, next);

    assert.strictEqual(statusCode, 401);
    assert.ok(jsonResponse.error.includes('Token JWT ausente'));
  });

});
