ARG MOSQUITTO_IMAGE
FROM ${MOSQUITTO_IMAGE}

COPY infra/mosquitto/mosquitto-entrypoint.sh /usr/local/bin/classmate-mosquitto-entrypoint
COPY --chown=mosquitto:mosquitto infra/mosquitto/acl.conf /mosquitto/config/acl.base.conf
RUN chmod 755 /usr/local/bin/classmate-mosquitto-entrypoint \
    && chmod 600 /mosquitto/config/acl.base.conf

ENTRYPOINT ["/usr/local/bin/classmate-mosquitto-entrypoint"]
