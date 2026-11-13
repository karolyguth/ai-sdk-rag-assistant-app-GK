FROM node:20-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

# Előbb a függőségek, hogy ez a réteg cache-elődjön
# A dev függőségek is kellenek: a migráció tsx-szel fut induláskor
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Csak a szükséges fájlok kerülnek az image-be (a .env nem)
COPY tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs .eslintrc.json drizzle.config.ts components.json ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts

# Az env változók csak futáskor léteznek, ezért buildkor nincs validáció
RUN SKIP_ENV_VALIDATION=1 pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# Induláskor migráció, utána a szerver
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
