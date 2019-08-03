FROM node as build
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app

RUN npm i -g yarn
RUN yarn add typescript --global
RUN yarn add tsc gts --global

COPY package.json ./
COPY tsconfig.json ./
COPY prettier.config.js ./
RUN yarn install --production

COPY . .
RUN rm -rf ./__tests__ 
RUN yarn build


COPY --chown=node:node . .
USER node

FROM node
COPY --from=build /home/node/app /
HEALTHCHECK CMD curl --fail http://localhost/.well-known/apollo/server-health || exit 1
EXPOSE 80
ENV GRPC_DNS_RESOLVER=native
CMD [ "node", "build/src/server.js" ]