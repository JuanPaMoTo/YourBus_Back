# YourBus_Back

API REST de YourBus: Node.js + Express 4 + MongoDB Atlas (Mongoose). Rutas, paraderos, horarios, usuarios con roles, turnos, recorrido en vivo (GPS) y ETA. Proyecto académico con pipeline en Azure DevOps (ambientes DEV, QA y PROD). El README tiene el detalle de endpoints y roles.

## Comandos
- `npm run dev` — nodemon; `npm start` — producción
- `npm run lint` — eslint sobre `src` y `tests`
- `npm test` — Jest con cobertura (usa `mongodb-memory-server`, no toca Atlas)
- `npm run db:seed` — siembra datos (requiere `MONGODB_URI`; no ejecutar contra QA/PROD sin que el usuario lo pida)

## Estructura
- `src/app.js` (Express), `src/bootstrap.js`, `src/server.js`, `src/seed.js`
- `src/routes`, `src/controllers`, `src/models`, `src/middleware`, `src/utils` (ETA, rutas por calle, fechas, geo)
- `tests/` — Jest + supertest
- Roles: `pasajero` (se registra solo), `conductor` y `admin` (los crea un admin). El registro público siempre crea pasajeros.

## Reglas (obligatorias)
1. **Nunca saltarse Husky**: no usar `--no-verify`, `HUSKY=0` ni desactivar hooks. `pre-commit` corre el lint y `pre-push` corre los tests. Si un hook falla, se arregla la causa.
2. **Git**: agregar solo los archivos del cambio (`git add <archivo>`), nunca `git add .` ni `-A`; puede haber trabajo en curso del usuario sin commitear que no se debe arrastrar. No hacer commit ni push sin que el usuario lo pida.
3. **Push**: `git push azure main`. El remoto `azure` sube a Azure DevOps (dispara el pipeline) y a GitHub. El remoto `origin` es solo GitHub.
4. **Secretos**: `.env` contiene `MONGODB_URI`, `JWT_SECRET` y `ADMIN_PASSWORD`. No leerlo, mostrarlo ni copiarlo; `.env.example` sí se puede leer. En Azure los valores viven en el variable group `YourBus-Backend-Vars`. Una contraseña de Atlas ya estuvo expuesta en el historial de git y fue rotada: no volver a versionar secretos.
5. **Pruebas**: todo endpoint o regla nueva lleva pruebas en `tests/`. Si cambia el contrato de la API, avisar para actualizar `src/services/api.js` en el front.
6. **Ambientes**: una base por entorno en el mismo cluster (`yourbus_dev`, `yourbus_qa`, `yourbus_prod`). La app de QA en Azure se llama `yourbus-back-qa2`.

## Pipeline (cada etapa tiene un solo propósito)
1 Compile/Build → 2 Quality Gates (lint, pruebas, SonarCloud) → 3 Package → 4 Deploy DEV → 5 Deploy QA → 6 Seguridad (ZAP sobre QA) → 7 Deploy PROD. Archivo: `.pipeline/azure-pipelines.yml`.

## Pendiente (al 2 de noviembre de 2026, según el tablero y el código)
Incidentes implementados (HU14, HU15, HU16, HU08; HU07 cubierta como aviso dentro de la app, sin notificaciones push): modelo `Incidente`, `GET /api/incidentes/activos` y `GET /api/rutas/:rutaId/incidentes` (públicos), `POST /api/incidentes` (conductor/admin), `GET /api/incidentes` y `PATCH /api/incidentes/:id/estado` (admin). Sus rutas se montan desde `rutas.routes.js`. Paraderos y horarios son solo lectura (HU12 y HU13 piden administrarlos). HU18: el turno guarda la velocidad, pero el cálculo de ETA todavía no la usa.
