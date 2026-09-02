# YourBus_Back

API REST del sistema de transporte público **YourBus**, construida con Node.js y Express. Expone rutas, paraderos, horarios, ubicación de buses y ETA, consumidos por [`YourBus_Front`](../YourBus_Front).

## Estructura

```
src/
├── app.js                 # Configuración de Express (middlewares + rutas)
├── server.js               # Punto de entrada (levanta el puerto)
├── config/env.js           # Variables de entorno centralizadas
├── middleware/
│   ├── cors.js             # CORS configurado por entorno (CORS_ORIGIN)
│   └── errorHandler.js     # 404 y manejo de errores centralizado
├── routes/                 # Definición de endpoints
├── controllers/            # Lógica de cada endpoint
└── data/store.js           # Datos en memoria (reemplazar por BD real)
tests/                      # Pruebas de integración (Jest + Supertest)
```

## Requisitos

- Node.js 20.x o superior

## Instalación local

```bash
npm install
cp .env.example .env
npm run dev
```

El servidor queda disponible en `http://localhost:4000`.

## Variables de entorno

| Variable      | Descripción                                         | Ejemplo                              |
|---------------|------------------------------------------------------|---------------------------------------|
| `PORT`        | Puerto del servidor                                  | `4000`                                |
| `NODE_ENV`    | Entorno de ejecución                                 | `development` / `qa` / `production`   |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma              | `http://localhost:5173,https://...`   |

## Endpoints principales

| Método | Endpoint                          | Descripción                       |
|--------|------------------------------------|------------------------------------|
| GET    | `/health`                          | Estado del servicio                |
| GET    | `/api/rutas`                       | Lista de rutas                     |
| GET    | `/api/rutas/:rutaId/estado`        | Estado operativo de una ruta       |
| GET    | `/api/rutas/:rutaId/paraderos`     | Paraderos de una ruta              |
| GET    | `/api/rutas/:rutaId/horarios`      | Horarios de una ruta               |
| GET    | `/api/buses/:busId/ubicacion`      | Ubicación en vivo de un bus        |
| GET    | `/api/paraderos/:paraderoId/eta`   | Tiempo estimado de llegada         |
| POST   | `/api/buses`                       | Registra un bus nuevo (`placa`, `empresa`) |

## Pruebas y calidad

```bash
npm run lint     # ESLint
npm test         # Jest + cobertura (Supertest sobre src/app.js)
```

Estos mismos comandos son los que ejecuta el pipeline de Azure en la etapa de **Quality Gates** antes de permitir el despliegue a QA/PROD (ver `.pipeline/azure-pipelines.yml`).

## Despliegue

Ver `.pipeline/azure-pipelines.yml` para el pipeline de CI/CD (Build → Package → Deploy, con promoción DEV → QA → PROD).
