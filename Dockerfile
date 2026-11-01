# One container serves the API, the WebSocket and the built React app.
FROM node:22-slim AS build
WORKDIR /app
COPY client/package*.json client/
RUN npm --prefix client install
COPY client client
RUN npm --prefix client run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=4000
COPY server/package*.json server/
RUN npm --prefix server install --omit=dev
COPY server server
COPY --from=build /app/client/dist client/dist
VOLUME /data
EXPOSE 4000
# JWT_SECRET must be provided at runtime: docker run -e JWT_SECRET=... -p 4000:4000 -v splitmate:/data splitmate
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
