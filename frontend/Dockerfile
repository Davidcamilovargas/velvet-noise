# Frontend — build multi-etapa: compila los estáticos con Vite y los sirve
# con Nginx. Las variables VITE_* de Vite se "hornean" dentro del bundle en
# tiempo de build (no se leen en tiempo de ejecución), así que se reciben
# como build args — hay que pasarlas al hacer `docker build`:
#
#   docker build \
#     --build-arg VITE_API_URL=https://api.tudominio.com/api \
#     --build-arg VITE_WOMPI_PUBLIC_KEY=pub_prod_xxx \
#     -t tiendavirtual-frontend ./frontend
#
# (docker-compose.yml de este repo ya pasa estos build args desde el .env
# de la raíz — ver ese archivo.)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=http://localhost:4000/api
ARG VITE_WOMPI_PUBLIC_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WOMPI_PUBLIC_KEY=$VITE_WOMPI_PUBLIC_KEY

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
