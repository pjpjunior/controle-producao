FROM node:20-alpine

WORKDIR /usr/src/app

ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/app_db?schema=public
ENV DATABASE_URL=${DATABASE_URL}

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
