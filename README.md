# YourBus_Back

API REST del sistema de transporte público **YourBus**, construida con Node.js, Express y **MongoDB (Mongoose)**, alojada en MongoDB Atlas. Expone rutas, paraderos, horarios, ubicación de buses y ETA, consumidos por [`YourBus_Front`](../YourBus_Front).

## Estructura

```
src/
├── app.js                 # Configuración de Express (middlewares + rutas)
├── server.js               # Punto de entrada (conecta a Mongo y levanta el puerto)
├── seed.js                 # Script para poblar datos de ejemplo
├── config/
│   ├── env.js               # Variables de entorno centralizadas
│   └── database.js          # Conexión a MongoDB (Mongoose)
├── middleware/
│   ├── cors.js              # CORS configurado por entorno (CORS_ORIGIN)
│   └── errorHandler.js      # 404 y manejo de errores centralizado
├── models/                  # Esquemas Mongoose: Ruta, Paradero, Horario, Bus
├── routes/                  # Definición de endpoints
├── controllers/             # Lógica de cada endpoint
└── utils/resolverRuta.js    # Busca una ruta por ObjectId o por código
tests/                       # Pruebas de integración (Jest + Supertest + mongodb-memory-server)
```

## Requisitos

- Node.js 20.x o superior
- Una base de datos en MongoDB Atlas (o local) y su connection string

## Instalación local

```bash
npm install
cp .env.example .env   # reemplaza MONGODB_URI con tu connection string real
npm run db:seed        # opcional: pobla datos de ejemplo
npm run dev
```

El servidor queda disponible en `http://localhost:4000`.

## Variables de entorno

| Variable      | Descripción                                         | Ejemplo                              |
|---------------|------------------------------------------------------|---------------------------------------|
| `PORT`        | Puerto del servidor                                  | `4000`                                |
| `NODE_ENV`    | Entorno de ejecución                                 | `development` / `qa` / `production`   |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma              | `http://localhost:5173,https://...`   |
| `MONGODB_URI` | Connection string completa de MongoDB Atlas          | `mongodb+srv://user:pass@cluster0.../yourbus_dev` |

**Importante:** usa una base distinta por entorno (`yourbus_dev`, `yourbus_qa`, `yourbus_prod`) dentro del mismo cluster, cambiando el nombre al final de la URL antes del `?`. En Atlas, recuerda habilitar **Network Access → Allow Access from Anywhere (0.0.0.0/0)**, ya que Azure App Service no tiene IP fija.

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

`:rutaId` acepta tanto el `ObjectId` de Mongo como el código corto de la ruta (ej. `L4`).

## Pruebas y calidad

```bash
npm run lint     # ESLint
npm test         # Jest + cobertura (Supertest + mongodb-memory-server, sin tocar Atlas)
```

Estos mismos comandos son los que ejecuta el pipeline de Azure en la etapa de **Quality Gates** antes de permitir el despliegue a QA/PROD (ver `.pipeline/azure-pipelines.yml`).

## Despliegue

Ver `.pipeline/azure-pipelines.yml` para el pipeline de CI/CD (Build → Package → Deploy, con promoción DEV → QA → PROD). Cada entorno usa su propia variable `MONGODB_URI_<ENV>` configurada en Azure DevOps Library, apuntando a la base correspondiente en el mismo cluster de Atlas.
