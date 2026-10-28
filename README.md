# YourBus_Back

API REST del sistema de transporte público **YourBus**, construida con Node.js, Express y **MongoDB (Mongoose)**, alojada en MongoDB Atlas. Expone rutas, paraderos, horarios, **cuentas con roles** (pasajero, conductor, administrador de terminal), **turnos**, **recorrido en vivo con GPS** y **ETA por calles**, consumidos por [`YourBus_Front`](../YourBus_Front).

## Estructura

```
src/
├── app.js                 # Configuración de Express (middlewares + rutas)
├── server.js              # Punto de entrada (conecta a Mongo, prepara datos y levanta el puerto)
├── bootstrap.js           # Arranque: siembra datos si la base está vacía y crea el admin inicial
├── seed.js / seedData.js  # Datos de ejemplo (rutas, paraderos con coordenadas, buses, cuentas demo)
├── config/
│   ├── env.js             # Variables de entorno centralizadas (valida JWT_SECRET)
│   ├── database.js        # Conexión a MongoDB (Mongoose)
│   └── mongoose.js        # Los JSON incluyen "id" y no "__v"
├── middleware/
│   ├── auth.js            # requireAuth (JWT) y requireRol(...)
│   ├── cors.js            # CORS configurado por entorno (CORS_ORIGIN)
│   └── errorHandler.js    # 404 y manejo de errores centralizado
├── models/                # Ruta, Paradero, Horario, Bus, Usuario, Turno
├── routes/                # Definición de endpoints
├── controllers/           # Lógica de cada endpoint
└── utils/                 # geo, fechas, jwt, routing (OSRM), eta, caché, serializadores
tests/                     # Jest + Supertest + mongodb-memory-server (sin tocar Atlas)
.husky/                    # Hooks de git: lint antes de cada commit, pruebas antes de cada push
```

## Requisitos

- Node.js 20.x o superior
- Una base de datos en MongoDB Atlas (o local) y su connection string

## Instalación local

```bash
npm install
cp .env.example .env   # reemplaza MONGODB_URI con tu connection string real
npm run db:seed        # opcional: rutas, paraderos, buses y cuentas de demostración
npm run dev
```

El servidor queda disponible en `http://localhost:4000`.

`npm run db:seed` **borra y recrea** rutas, paraderos, horarios, buses y turnos. Crea (si no existen) las cuentas `admin@yourbus.cl`, `conductor@yourbus.cl` y `pasajero@yourbus.cl`; imprime sus contraseñas **una sola vez** (o usa `ADMIN_PASSWORD` / `DEMO_PASSWORD` si las defines).

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto del servidor | `4000` |
| `NODE_ENV` | Entorno de ejecución | `development` / `qa` / `production` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma (o `*`) | `http://localhost:5173,https://...` |
| `MONGODB_URI` | Connection string completa de MongoDB Atlas | `mongodb+srv://user:pass@cluster0.../yourbus_dev` |
| `JWT_SECRET` | Firma las sesiones. **Obligatoria en QA/PROD** (mín. 16 caracteres al azar) | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Duración de la sesión (opcional) | `8h` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador inicial: se crea al arrancar si no existe | `admin@terminal.cl` / (mín. 8) |
| `AUTO_SEED` | `true` carga los datos de ejemplo si la base no tiene rutas | `true` |
| `TZ_OPERACION` | Zona horaria que define "hoy" para los turnos | `America/Santiago` |
| `OSRM_URL` | Servidor de rutas para el ETA (opcional) | `https://router.project-osrm.org` |
| `ETA_FACTOR_BUS`, `ETA_SEGUNDOS_PARADA`, `ETA_CACHE_SEGUNDOS` | Ajustes del ETA (opcionales) | `1.3`, `20`, `15` |

**Importante:** usa una base distinta por entorno (`yourbus_dev`, `yourbus_qa`, `yourbus_prod`) dentro del mismo cluster. En Atlas, habilita **Network Access → Allow Access from Anywhere (0.0.0.0/0)**, ya que Azure App Service no tiene IP fija.

## Roles y permisos

| Rol | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| `pasajero` | Se registra solo (`POST /api/auth/registro`) | Ver rutas, paraderos, buses en vivo y ETA |
| `conductor` | Lo crea un administrador | Ver **sus** turnos; iniciar, transmitir GPS y finalizar **sus** recorridos |
| `admin` | Lo crea otro administrador, o `ADMIN_EMAIL`/`ADMIN_PASSWORD` | Usuarios, flota y turnos |

El registro público **siempre** crea pasajeros: el rol que envíe el cliente se ignora. El servidor vuelve a leer al usuario en cada petición, así que desactivar una cuenta corta su sesión de inmediato.

## Endpoints

**Públicos**

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/api/rutas` | Lista de rutas |
| GET | `/api/rutas/:rutaId/estado` | Estado operativo de una ruta |
| GET | `/api/rutas/:rutaId/paraderos` | Paraderos (con `lat`/`lng`) |
| GET | `/api/rutas/:rutaId/horarios` | Frecuencias de una ruta |
| GET | `/api/rutas/:rutaId/buses-activos` | Buses circulando ahora, con su última posición (sin datos del conductor) |
| GET | `/api/turnos/:id/eta?paraderoId=` | ETA de un bus hacia un paradero, por calles |
| GET | `/api/paraderos/:paraderoId/eta` | ETA del bus que llegue primero a ese paradero |
| GET | `/api/buses/:busId/ubicacion` | Última ubicación de un bus |
| POST | `/api/auth/registro` | Crea una cuenta de pasajero (`nombre`, `email`, `password`) |
| POST | `/api/auth/login` | Devuelve `{ token, usuario }` |

**Con sesión** (`Authorization: Bearer <token>`)

| Método | Endpoint | Rol | Descripción |
|---|---|---|---|
| GET | `/api/auth/me` | cualquiera | Usuario de la sesión |
| GET | `/api/turnos/mios?desde=&hasta=` | conductor | Mi calendario |
| POST | `/api/turnos/:id/iniciar` | conductor | Inicia el recorrido (solo turnos de hoy) |
| POST | `/api/turnos/:id/ubicacion` | conductor | Envía `{ lat, lng, velocidad?, rumbo?, precision? }` |
| POST | `/api/turnos/:id/finalizar` | conductor | Termina el recorrido |
| GET/POST | `/api/turnos` | admin | Lista (filtros `desde`, `hasta`, `conductorId`, `rutaId`, `busId`, `estado`) / crea |
| PUT/DELETE | `/api/turnos/:id` | admin | Edita (solo programados) / elimina |
| POST | `/api/turnos/:id/cancelar` | admin | Cancela un turno programado |
| GET/POST | `/api/usuarios` | admin | Lista (`?rol=`) / crea conductores y administradores |
| PATCH | `/api/usuarios/:id` | admin | Activa o desactiva una cuenta (`{ activo }`) |
| GET/POST | `/api/buses` | admin | Lista / registra buses |

`:rutaId` acepta el `ObjectId` de Mongo o el código corto (ej. `L4`).

## Cómo funciona el recorrido en vivo (polling GPS)

1. El administrador crea un **turno**: conductor + ruta + bus + fecha + horas. El sistema rechaza turnos que se cruzan para el mismo conductor o el mismo bus.
2. Ese día, el conductor pulsa **Iniciar recorrido**. Su teléfono envía la posición cada ~5 s a `POST /api/turnos/:id/ubicacion` (aunque no se mueva, como "latido").
3. En cada envío el servidor guarda la posición y, si el bus está a menos de **80 m** del siguiente paradero, lo marca como recorrido.
4. Los pasajeros consultan `buses-activos` cada ~5 s (polling) y ven los buses en el mapa. Si pasan más de 90 s sin señal, el bus se marca "sin señal reciente".
5. **ETA por calles:** no es la línea recta bus→paradero. Se arma la secuencia *posición del bus → próximo paradero → … → paradero de destino* y se pide a **OSRM** (motor de rutas sobre OpenStreetMap) la distancia y el tiempo siguiendo las calles. El tiempo de auto se multiplica por `ETA_FACTOR_BUS` y se suman `ETA_SEGUNDOS_PARADA` por cada parada intermedia. El resultado se guarda en caché ~15 s para no consultar el servicio en cada petición.
6. Si OSRM no responde (5 s), el sistema **no se queda sin ETA**: cae a una estimación en línea recta × 1,35 (rodeo urbano) a 20 km/h, y lo informa en `metodo: "estimacion_lineal"` para que la interfaz avise que es aproximado.

> **Servidor OSRM:** `router.project-osrm.org` es el servidor de demostración del proyecto OSRM: sirve para esta demo académica, pero sin garantías ni cuotas. Para uso real, apunta `OSRM_URL` a un OSRM propio u otro proveedor.

Limitaciones conocidas: los turnos no cruzan la medianoche (hora de fin posterior a la de inicio, el mismo día) y el navegador del conductor deja de enviar GPS si el teléfono se bloquea (el front usa Wake Lock para mantener la pantalla encendida).

## Pruebas y calidad

```bash
npm run lint     # ESLint
npm test         # Jest + cobertura (Supertest + mongodb-memory-server, sin tocar Atlas)
```

Las pruebas usan un Mongo real en memoria. Si prefieres otro servidor (por ejemplo un contenedor en CI), define `TEST_MONGODB_URI`. Estos mismos comandos son el **Quality Gate** del pipeline (ver `.pipeline/azure-pipelines.yml`).

### Husky (hooks de git)

`npm install` activa Husky (`prepare`). Antes de cada **commit** corre `npm run lint` y antes de cada **push** corre `npm test`; si fallan, git no continúa. En el pipeline de CI se desactiva con `HUSKY=0`. Para saltarlo puntualmente: `git commit --no-verify`.

### SonarCloud (inspección de código)

El pipeline ya trae las tareas de SonarCloud, apagadas por defecto (`runSonar: 'false'`). Para activarlas:

1. En <https://sonarcloud.io> entra con tu cuenta de Azure DevOps y crea una **organización** (plan gratuito).
2. En SonarCloud: **Analyze new project** → elige el repo `YourBus_Back` de Azure DevOps. Copia la **Project Key**.
3. En SonarCloud: **My Account → Security → Generate Token** y copia el token.
4. En Azure DevOps, instala la extensión **SonarQube Cloud** (Marketplace) en tu organización.
5. **Project settings → Service connections → New → SonarCloud**: pega el token y ponle de nombre exactamente `SonarCloud`.
6. En `.pipeline/azure-pipelines.yml` cambia `sonarOrganization`, `sonarProjectKey` y `runSonar: 'true'`. Haz commit.
7. Para evitar análisis duplicado, en SonarCloud: **Administration → Analysis Method** → desactiva *Automatic Analysis*.

Los pasos exactos de la interfaz pueden variar; si la versión de la extensión no coincide con `@4`, ajusta el número en las tareas `SonarCloudPrepare/Analyze/Publish`.

## Despliegue

Ver `.pipeline/azure-pipelines.yml` para el pipeline de CI/CD (Build → Package → Deploy, con promoción DEV → QA → PROD). Cada entorno usa su propia variable `MONGODB_URI_<ENV>` en la variable group `YourBus-Backend-Vars`. Además deben existir `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` (las dos secretas marcadas con el candado). Evita comillas y el símbolo `$` en `ADMIN_PASSWORD`, porque el pipeline la pasa como texto a la configuración de la app.
