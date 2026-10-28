const { crearUsuario } = require('../../src/controllers/auth.controller');
const { firmarToken } = require('../../src/utils/jwt');

// Crea un usuario con el rol indicado y devuelve su token listo para usar.
async function crearCuenta(rol, email = `${rol}@prueba.cl`) {
  const usuario = await crearUsuario({
    nombre: `Usuario ${rol}`,
    email,
    password: 'clave-segura-123',
    rol,
  });
  return { usuario, token: firmarToken(usuario), auth: { Authorization: `Bearer ${firmarToken(usuario)}` } };
}

module.exports = { crearCuenta };
