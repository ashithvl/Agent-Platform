# Build SPA
FROM node:20-alpine AS web-build
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web/ ./
RUN npm run build

FROM nginx:alpine
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=web-build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
