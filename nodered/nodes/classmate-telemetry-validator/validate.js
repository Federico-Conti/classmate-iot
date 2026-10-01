const fs = require('node:fs');
const Ajv2020 = require('ajv/dist/2020');

const schema = JSON.parse(fs.readFileSync(
    process.env.TELEMETRY_SCHEMA_PATH || '/opt/classmate/contracts/mqtt/schemas/telemetry.schema.json',
    'utf8',
));
const validatePayload = new Ajv2020({ allErrors: true }).compile(schema);
const topicPattern = /^classmate\/v1\/devices\/([a-z0-9][a-z0-9-]{2,63})\/telemetry$/;
const decoder = new TextDecoder('utf-8', { fatal: true });

function validateTelemetry(topic, payload) {
    // Accept only a versioned telemetry topic with a valid device ID.
    const topicMatch = typeof topic === 'string' && topicPattern.exec(topic);
    if (!topicMatch) return { valid: false, reason: 'invalid-topic' };

    // The payload must be valid UTF-8 text and JSON-compatible.
    let data;
    try {
        const text = Buffer.isBuffer(payload) ? decoder.decode(payload) : payload;
        if (typeof text !== 'string') return { valid: false, reason: 'invalid-json' };
        data = JSON.parse(text);
    } catch {
        return { valid: false, reason: 'invalid-json' };
    }

    // Check the telemetry json schema, including required fields and value ranges.
    if (!validatePayload(data)) return { valid: false, reason: 'invalid-payload' };
    // The deviceId in the JSON must match the one in the topic.
    if (data.deviceId !== topicMatch[1]) return { valid: false, reason: 'device-id-mismatch' };
    return { valid: true, data };
}

module.exports = { validateTelemetry };
