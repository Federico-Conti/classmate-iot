ARG NODE_RED_IMAGE
FROM ${NODE_RED_IMAGE}

USER root
RUN mkdir -p /data/sqlite /data/node_modules/classmate-db /opt/classmate/database \
    && chown -R node-red:node-red /data /opt/classmate
COPY --chown=node-red:node-red database /opt/classmate/database
COPY --chown=node-red:node-red nodered/nodes/classmate-db /data/node_modules/classmate-db
COPY --chown=node-red:node-red nodered/nodes/classmate-telemetry-validator /data/node_modules/classmate-telemetry-validator
COPY --chown=node-red:node-red contracts/mqtt/schemas/telemetry.schema.json /opt/classmate/contracts/mqtt/schemas/telemetry.schema.json
COPY --chown=node-red:node-red nodered/entrypoint.sh /usr/local/bin/classmate-node-red-entrypoint.sh
RUN chmod 755 /usr/local/bin/classmate-node-red-entrypoint.sh
USER node-red
ENTRYPOINT ["/usr/local/bin/classmate-node-red-entrypoint.sh"]
