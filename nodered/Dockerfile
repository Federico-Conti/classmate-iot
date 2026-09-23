ARG NODE_RED_IMAGE
FROM ${NODE_RED_IMAGE}

USER root
RUN mkdir -p /data/sqlite /data/node_modules/classmate-db /opt/classmate/database \
    && chown -R node-red:node-red /data /opt/classmate
COPY --chown=node-red:node-red database /opt/classmate/database
COPY --chown=node-red:node-red nodered/nodes/classmate-db /data/node_modules/classmate-db
USER node-red
