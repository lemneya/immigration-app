FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm@8
COPY package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production
ENV PORT=3017
EXPOSE 3017
CMD ["node", "dist/index.js"]