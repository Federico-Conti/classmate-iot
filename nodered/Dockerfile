ARG NODE_RED_IMAGE=nodered/node-red:4.0.9-22
FROM ${NODE_RED_IMAGE}

USER root
RUN mkdir -p /data/sqlite && chown -R node-red:node-red /data
USER node-red
