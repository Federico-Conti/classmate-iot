const path = require('node:path');
const { OutboxPublisher } = require('./publisher');

module.exports = function registerOutboxPublisher(RED) {
    const databaseModulePath = process.env.CLASSMATE_DATABASE_MODULE
        || path.resolve(__dirname, '../../../database/classmate-db.cjs');
    const { ClassMateDatabase } = require(databaseModulePath);

    function ClassMateOutboxPublisherNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const broker = RED.nodes.getNode(config.broker);
        if (!broker) {
            node.error('MQTT broker is not configured');
            return;
        }
        const database = new ClassMateDatabase(config.database || process.env.SQLITE_PATH);
        const publisher = new OutboxPublisher(database, broker);

        node.on('input', (message, send, done) => {
            publisher.flush().then(() => done(), (error) => done(error));
        });
        node.on('close', () => {
            publisher.close();
            database.close();
        });
    }

    RED.nodes.registerType('classmate-outbox-publisher', ClassMateOutboxPublisherNode);
};
