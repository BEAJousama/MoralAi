FROM node:22-alpine AS builder
ARG VITE_API_BASE=
ENV VITE_API_BASE=${VITE_API_BASE}
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve with nginx (single origin: /api proxied to backend)
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
