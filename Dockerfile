FROM node:lts-alpine3.22

WORKDIR /app

RUN adduser -u 2004 -D docker

COPY --chown=docker:docker --chmod=0777 lib lib
COPY --chown=docker:docker --chmod=0777 workspaces workspaces
COPY --chown=docker:docker --chmod=0644 package.json package-lock.json tsconfig.json register.js ./
COPY --chown=docker:docker --chmod=0555 entrypoint.sh entrypoint.sh

# Install packages to root and workspaces
RUN npm install --legacy-peer-dep \
    && npm install --legacy-peer-dep --workspaces
# Generate documentation
RUN npm start -w docs-generator \
    && mv workspaces/docs-generator/docs /docs \
    && chmod -R 0777 /docs 
    
# Prepare env
RUN mv workspaces/codacy/src/tsconfig.src.json /tsconfig.json  \
    && ln -s /app/node_modules /node_modules

WORKDIR /src

CMD [ "/app/entrypoint.sh" ]
