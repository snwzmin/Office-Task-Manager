FROM node:20-alpine

WORKDIR /app

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]