# Backend — build multi-etapa.
#
# Etapa 1 (deps): instala TODAS las dependencias (incluye devDependencies,
# necesarias para compilar TypeScript).
# Etapa 2 (build): compila src/ -> dist/ con tsc.
# Etapa 3 (runtime): imagen final, solo dependencias de producción + el
# dist/ ya compilado — no lleva el código fuente TS ni devDependencies,
# así que la imagen final es más chica y no expone herramientas de build.
#
# No hay ninguna dependencia nativa (bcryptjs es JS puro, no bcrypt), así
# que no se necesita python3/make/g++ para node-gyp en ninguna etapa.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# migrate.ts (dist/db/migrate.js) lee las migraciones desde una ruta
# relativa al cwd del proceso ("./src/db/migrations"), así que ese
# directorio de archivos .sql se copia también, aunque no sea código
# compilado — son los mismos archivos que genera `drizzle-kit generate`.
COPY --from=build /app/src/db/migrations ./src/db/migrations

# Usuario sin privilegios — nunca correr el proceso de Node como root.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Corre las migraciones pendientes y luego arranca el servidor. Reutiliza
# el mismo script db:migrate que se usa en desarrollo (src/db/migrate.ts,
# compilado a dist/db/migrate.js) — nunca "db push" ni sincronización
# implícita del schema en producción.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
