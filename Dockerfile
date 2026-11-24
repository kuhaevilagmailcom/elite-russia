FROM node:22-bookworm-slim
ENV NODE_ENV=production BIND_HOST=0.0.0.0

# BotHost bind-mounts the Git checkout over /app at runtime. Keep the built
# application and node_modules outside that mount; /app/data remains persistent.
WORKDIR /usr/src/minion-market
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node . .
RUN mkdir -p /app/data \
    && chown -R node:node /usr/src/minion-market /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","--experimental-sqlite","server-async.mjs"]
