const { validateTelemetry } = require('./validate');

module.exports = function registerTelemetryValidator(RED) {
    function TelemetryValidatorNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.on('input', (message, send, done) => {
            const result = validateTelemetry(message.topic, message.payload);
            if (result.valid) {
                message.payload = result.data;
                send([message, null]);
            } else {
                send([null, { topic: message.topic, payload: { reason: result.reason } }]);
            }
            done();
        });
    }

    RED.nodes.registerType('classmate-telemetry-validator', TelemetryValidatorNode);
};
