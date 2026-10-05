# Base de datos · cómo aplicar las migraciones

La base de datos corre en Docker. Mientras el contenedor esté apagado, Prisma falla con
`P1001: Can't reach database server at localhost:5432`.

## 1. Levantar PostgreSQL

Abrí **Docker Desktop** y esperá a que el motor esté en estado *Running*. Luego, desde la raíz
del repositorio:

```powershell
cd C:\Users\Vladimir\OneDrive\Desktop\fitness-naturalCR
docker compose up -d db
docker ps
```

Deberías ver el contenedor `fitness_natural_db` en estado `Up` y el puerto `5432` publicado.

## 2. Aplicar las migraciones

Las migraciones ya están escritas en `apps/api/prisma/migrations`. Solo hay que aplicarlas:

```powershell
cd C:\Users\Vladimir\OneDrive\Desktop\fitness-naturalCR\apps\api
npx prisma migrate deploy
```

`migrate deploy` aplica en orden todas las migraciones que falten y es el comando correcto
cuando los archivos SQL ya existen (fueron escritos a mano porque la base estaba apagada).

Migraciones que se aplicarán:

| Migración | Qué hace |
| --- | --- |
| `20260201184932_init_leads` | Tabla de leads inicial |
| `20260203063602_leads_invites_profiles_subs` | Invitaciones, perfiles y suscripciones |
| `20260203090524_stripe_sub_unique` | Índice único de suscripción de Stripe |
| `20260225053611_add_client_profile` | Perfil de cliente |
| `20260301064847_adfasdf` | Planes de entrenamiento |
| `20260305120000_mvp_fitness_natural` | Recorte al MVP: elimina `WeeklyCheckIn`, agrega campos a `Coach` y `ClientProfile` |
| `20260306090000_nutrition_plan` | CU-09: `NutritionPlan`, `NutritionMeal`, `NutritionItem` |

## 3. Verificar

```powershell
npx prisma migrate status
npx prisma generate
npx prisma studio
```

`migrate status` debe reportar que la base está al día. `prisma studio` abre un explorador web
donde podés confirmar que existen las tablas `NutritionPlan`, `NutritionMeal` y `NutritionItem`.

## Alternativa: empezar de cero

Si la base tiene datos de prueba que no te importan y querés evitar cualquier conflicto de
estado, podés recrearla por completo. **Esto borra todos los datos:**

```powershell
cd C:\Users\Vladimir\OneDrive\Desktop\fitness-naturalCR\apps\api
npx prisma migrate reset
```

## Problemas comunes

- **`P1001` después de levantar Docker**: esperá unos segundos, Postgres tarda en aceptar
  conexiones. Revisá los logs con `docker logs fitness_natural_db`.
- **`DATABASE_URL` no coincide**: `apps/api/.env` debe apuntar a
  `postgresql://postgres:postgres@localhost:5432/fitness_natural?schema=public`, mismo nombre de
  base que `POSTGRES_DB` en `docker-compose.yml`.
- **Drift detectado**: si Prisma avisa que el esquema de la base no coincide con el historial,
  usá `npx prisma migrate reset` en desarrollo.
- **`Cannot find module 'chokidar'` al correr `pnpm dev` en la API**: `ts-node-dev` se resuelve
  desde el store de pnpm en la raíz, así que la dependencia debe instalarse ahí y no dentro de
  `apps/api`. Se corrige con `pnpm add -w -D chokidar` desde la raíz del repositorio. Evitá usar
  `npm install` dentro de los paquetes de este monorepo: desalinea las dependencias.

## 4. Arrancar la aplicación

```powershell
cd C:\Users\Vladimir\OneDrive\Desktop\fitness-naturalCR
pnpm dev
```
