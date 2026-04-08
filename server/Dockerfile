FROM node:22-slim

WORKDIR /app

# Copy only server package files (not the monorepo root)
COPY package.json package-lock.json ./

RUN npm ci --omit=dev 2>/dev/null; npm install 2>/dev/null || true

# Copy source and build
COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# Create uploads dir
RUN mkdir -p uploads

EXPOSE 10000

CMD ["node", "dist/index.js"]
