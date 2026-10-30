const request = require('supertest');
const app = require('../src/app');

// Cabeceras de seguridad que un escáner como OWASP ZAP exige (ver src/app.js).
describe('Cabeceras de seguridad', () => {
  it('responde con las cabeceras recomendadas y sin revelar el framework', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('también las incluye en los errores 404', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('permite que el front (otro dominio) lea las respuestas', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
