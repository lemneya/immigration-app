FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm@8
COPY package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production
ENV PORT=3020
EXPOSE 3020
CMD ["node", "dist/index.js"]