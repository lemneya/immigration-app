FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm@8
COPY package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production
ENV PORT=3016
EXPOSE 3016
CMD ["node", "dist/index.js"]