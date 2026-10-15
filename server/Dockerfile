FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY dist ./dist
COPY src/openapi.yaml ./dist/openapi.yaml
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
