module.exports = function registerClassMateDatabaseNode(RED) {
    const path = require("node:path");
    const databaseModulePath = process.env.CLASSMATE_DATABASE_MODULE
        || path.resolve(__dirname, "../../../database/lib/classmate-db.cjs");
    const { ClassMateDatabase } = require(databaseModulePath);

    const operations = {
        health: (database) => database.health(),
        resolveParent: (database, parameters) => database.resolveParent(parameters.code),
        listAssociatedChildren: (database, parameters) => database.listAssociatedChildren(parameters.code),
        getChildStatus: (database, parameters) => database.getChildStatus(parameters.code, parameters.childId),
        getChildHistory: (database, parameters) => database.getChildHistory(
            parameters.code,
            parameters.childId,
            { limit: parameters.limit, cursor: parameters.cursor },
        ),
        getActiveAssignmentByDevice: (database, parameters) => database.getActiveAssignmentByDevice(parameters.deviceId),
        assignDevice: (database, parameters) => database.assignDevice(parameters.deviceId, parameters.childId),
        updateDeviceState: (database, parameters) => database.updateDeviceState(parameters),
        commitAttendanceEvent: (database, parameters) => database.commitAttendanceEvent(parameters),
        listPendingOutbox: (database, parameters) => database.listPendingOutbox(parameters.limit),
        markOutboxPublished: (database, parameters) => database.markOutboxPublished(
            parameters.eventId,
            parameters.publishedAt,
        ),
    };

    function ClassMateDatabaseNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const database = new ClassMateDatabase(config.database || process.env.SQLITE_PATH);

        node.on("input", (message, send, done) => {
            try {
                const operation = operations[message.dbOperation];
                if (!operation) {
                    throw new Error(`Unsupported database operation: ${message.dbOperation}`);
                }
                message.payload = operation(database, message.params || {});
                send(message);
                done();
            } catch (error) {
                message.statusCode = error.code && error.code.startsWith("ERR_SQLITE_CONSTRAINT") ? 409 : 500;
                done(error);
            }
        });

        node.on("close", () => database.close());
    }

    RED.nodes.registerType("classmate-db", ClassMateDatabaseNode);
};
