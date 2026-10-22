const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

function requireText(value, fieldName) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new TypeError(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
}

function requireInteger(value, fieldName, minimum = 0) {
    if (!Number.isInteger(value) || value < minimum) {
        throw new TypeError(`${fieldName} must be an integer greater than or equal to ${minimum}`);
    }
    return value;
}

function encodeCursor(event) {
    return Buffer.from(JSON.stringify({ receivedAt: event.receivedAt, eventRowid: event.eventRowid }))
        .toString("base64url");
}

function decodeCursor(cursor) {
    if (!cursor) {
        return null;
    }

    try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        return {
            receivedAt: requireText(decoded.receivedAt, "cursor.receivedAt"),
            eventRowid: requireInteger(decoded.eventRowid, "cursor.eventRowid", 1),
        };
    } catch (error) {
        throw new TypeError(`cursor is invalid: ${error.message}`);
    }
}

function configureConnection(database) {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA synchronous = NORMAL;");
}

function mapParent(row) {
    if (!row) return null;
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        surname: row.surname,
    };
}

function mapChild(row) {
    return {
        id: row.id,
        name: row.name,
        surname: row.surname,
    };
}

function mapEvent(row) {
    return {
        eventId: row.event_id,
        childId: row.child_id,
        deviceId: row.device_id,
        type: row.type,
        receivedAt: row.received_at,
        weightedRssi: row.weighted_rssi,
    };
}

class ClassMateDatabase {
    constructor(databasePath) {
        this.databasePath = path.resolve(databasePath);
        fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
        this.database = new DatabaseSync(this.databasePath);
        configureConnection(this.database);
    }

    close() {
        this.database.close();
    }

    transaction(callback) {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const result = callback();
            this.database.exec("COMMIT;");
            return result;
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
    }

    health() {
        const result = this.database.prepare("PRAGMA quick_check").get();
        return {
            status: result.quick_check === "ok" ? "ok" : "degraded",
            database: result.quick_check,
        };
    }

    resolveParent(code) {
        const parent = mapParent(this.database.prepare(`
            SELECT id, code, name, surname
            FROM parents
            WHERE code = ? COLLATE NOCASE
        `).get(requireText(code, "code")));
        return parent ? { ...parent, children: this.listAssociatedChildren(code) } : null;
    }

    listAssociatedChildren(code) {
        return this.database.prepare(`
            SELECT c.id, c.name, c.surname
            FROM parents p
            JOIN parent_child pc ON pc.parent_id = p.id
            JOIN children c ON c.id = pc.child_id
            WHERE p.code = ? COLLATE NOCASE
            ORDER BY c.surname, c.name, c.id
        `).all(requireText(code, "code")).map(mapChild);
    }

    isAssociated(code, childId) {
        return Boolean(this.database.prepare(`
            SELECT 1
            FROM parents p
            JOIN parent_child pc ON pc.parent_id = p.id
            JOIN children c ON c.id = pc.child_id
            WHERE p.code = ? COLLATE NOCASE AND c.id = ?
        `).get(requireText(code, "code"), requireText(childId, "childId")));
    }

    getChildHistory(code, childId, options = {}) {
        if (!this.isAssociated(code, childId)) {
            return null;
        }

        const limit = Math.min(requireInteger(options.limit ?? 20, "limit", 1), 100);
        const cursor = decodeCursor(options.cursor);
        const rows = cursor
            ? this.database.prepare(`
                SELECT rowid AS event_rowid, event_id, child_id, device_id, type,
                       received_at, weighted_rssi
                FROM attendance_events
                WHERE child_id = ?
                  AND (received_at < ? OR (received_at = ? AND rowid < ?))
                ORDER BY received_at DESC, rowid DESC
                LIMIT ?
            `).all(childId, cursor.receivedAt, cursor.receivedAt, cursor.eventRowid, limit + 1)
            : this.database.prepare(`
                SELECT rowid AS event_rowid, event_id, child_id, device_id, type,
                       received_at, weighted_rssi
                FROM attendance_events
                WHERE child_id = ?
                ORDER BY received_at DESC, rowid DESC
                LIMIT ?
            `).all(childId, limit + 1);

        const hasMore = rows.length > limit;
        const events = rows.slice(0, limit).map(mapEvent);
        return {
            events,
            nextCursor: hasMore ? encodeCursor({ receivedAt: rows[limit - 1].received_at, eventRowid: rows[limit - 1].event_rowid }) : null,
        };
    }

    getAssignmentByDevice(deviceId) {
        const row = this.database.prepare(`
            SELECT d.id AS device_id, d.child_id
            FROM devices d
            WHERE d.id = ? AND d.child_id IS NOT NULL
        `).get(requireText(deviceId, "deviceId"));

        return row ? {
            deviceId: row.device_id,
            childId: row.child_id,
        } : null;
    }

    getLatestConfirmedEvent(childId) {
        const row = this.database.prepare(`
            SELECT event_id, type, received_at
            FROM attendance_events
            WHERE child_id = ?
            ORDER BY received_at DESC, rowid DESC
            LIMIT 1
        `).get(requireText(childId, "childId"));
        return row ? {
            eventId: row.event_id,
            type: row.type,
            receivedAt: row.received_at,
        } : null;
    }

    updateDeviceState(state) {
        const deviceId = requireText(state.deviceId, "deviceId");
        const lastReceivedAt = requireText(state.lastReceivedAt, "lastReceivedAt");
        const lastBootId = requireText(state.lastBootId, "lastBootId");
        const lastSequence = requireInteger(state.lastSequence, "lastSequence");

        return this.transaction(() => {
            if (!this.getAssignmentByDevice(deviceId)) {
                return { accepted: false, reason: "unassigned-device" };
            }
            const previous = this.database.prepare(
                "SELECT last_boot_id, last_sequence FROM device_state WHERE device_id = ?",
            ).get(deviceId);
            if (previous && previous.last_boot_id === lastBootId && lastSequence <= previous.last_sequence) {
                return { accepted: false, reason: lastSequence === previous.last_sequence ? "duplicate-sequence" : "old-sequence" };
            }
            this.database.prepare(`
                INSERT INTO device_state(device_id, last_received_at, last_boot_id, last_sequence)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(device_id) DO UPDATE SET
                    last_received_at = excluded.last_received_at,
                    last_boot_id = excluded.last_boot_id,
                    last_sequence = excluded.last_sequence
            `).run(deviceId, lastReceivedAt, lastBootId, lastSequence);
            return { accepted: true };
        });
    }

    commitAttendanceEvent(event) {
        return this.transaction(() => {
            const eventId = event.eventId === undefined ? crypto.randomUUID() : requireText(event.eventId, "eventId");
            const childId = requireText(event.childId, "childId");
            const deviceId = requireText(event.deviceId, "deviceId");
            const existing = this.database.prepare(
                "SELECT event_id FROM attendance_events WHERE event_id = ?",
            ).get(eventId);
            if (existing) {
                return { inserted: false, eventId };
            }

            const assignment = this.getAssignmentByDevice(deviceId);
            if (!assignment || assignment.childId !== childId) {
                throw new Error(`Device ${deviceId} is not assigned to child ${childId}`);
            }

            const type = requireText(event.type, "type");
            if (type !== "entry" && type !== "exit") {
                throw new TypeError("type must be entry or exit");
            }
            const receivedAt = requireText(event.receivedAt, "receivedAt");
            if (!Number.isFinite(Date.parse(receivedAt)) || new Date(receivedAt).toISOString() !== receivedAt) {
                throw new TypeError("receivedAt must be a server ISO timestamp");
            }
            const weightedRssi = event.weightedRssi;
            if (typeof weightedRssi !== "number" || !Number.isFinite(weightedRssi)
                || weightedRssi < -127 || weightedRssi > 0) {
                throw new TypeError("weightedRssi must be a finite RSSI value");
            }
            const lastEvent = this.getLatestConfirmedEvent(childId);
            if (lastEvent && receivedAt < lastEvent.receivedAt) {
                return { inserted: false, eventId, reason: "stale-event" };
            }
            if (lastEvent && lastEvent.type === type) {
                return { inserted: false, eventId, reason: "unchanged-state" };
            }
            const payload = JSON.stringify({ schemaVersion: 1, eventId, childId, type, occurredAt: receivedAt });

            this.database.prepare(`
                INSERT INTO attendance_events(
                    event_id, child_id, device_id, type, received_at, weighted_rssi
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                eventId,
                childId,
                deviceId,
                type,
                receivedAt,
                weightedRssi,
            );

            this.database.prepare(`
                INSERT INTO event_outbox(event_id, topic, payload)
                VALUES (?, ?, ?)
            `).run(
                eventId,
                `classmate/v1/children/${childId}/events`,
                payload,
            );

            return { inserted: true, eventId };
        });
    }

    listPendingOutbox(limit = 100) {
        return this.database.prepare(`
            SELECT outbox.event_id, outbox.topic, outbox.payload
            FROM event_outbox AS outbox
            JOIN attendance_events AS event ON event.event_id = outbox.event_id
            WHERE outbox.published_at IS NULL
            ORDER BY event.received_at ASC, event.rowid ASC
            LIMIT ?
        `).all(Math.min(requireInteger(limit, "limit", 1), 500)).map((row) => ({
            eventId: row.event_id,
            topic: row.topic,
            payload: JSON.parse(row.payload),
        }));
    }

    markOutboxPublished(eventId, publishedAt) {
        const result = this.database.prepare(`
            UPDATE event_outbox
            SET published_at = ?
            WHERE event_id = ? AND published_at IS NULL
        `).run(requireText(publishedAt, "publishedAt"), requireText(eventId, "eventId"));
        return result.changes === 1;
    }

    provision(seed) {
        return this.transaction(() => {
            const existingTable = this.database.prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1",
            ).get();
            if (existingTable) {
                throw new Error("Database already initialized; remove the container and SQLite volume before provisioning again");
            }
            this.database.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
            const insertParent = this.database.prepare(`
                INSERT INTO parents(id, code, name, surname)
                VALUES (?, ?, ?, ?)
            `);
            const insertChild = this.database.prepare(`
                INSERT INTO children(id, name, surname)
                VALUES (?, ?, ?)
            `);
            const insertAssociation = this.database.prepare(`
                INSERT INTO parent_child(parent_id, child_id)
                VALUES (?, ?)
            `);
            const insertDevice = this.database.prepare(`
                INSERT INTO devices(id, child_id)
                VALUES (?, NULL)
            `);
            for (const parent of seed.parents || []) {
                insertParent.run(parent.id, parent.code, parent.name, parent.surname);
            }
            for (const child of seed.children || []) {
                insertChild.run(child.id, child.name, child.surname);
            }
            for (const association of seed.associations || []) {
                insertAssociation.run(association.parentId, association.childId);
            }
            for (const device of seed.devices || []) {
                insertDevice.run(device.id);
            }
            for (const device of seed.devices || []) {
                if (device.childId) {
                    this.assignDeviceWithoutTransaction(device.id, device.childId);
                }
            }
            return {
                parents: (seed.parents || []).length,
                children: (seed.children || []).length,
                associations: (seed.associations || []).length,
                devices: (seed.devices || []).length,
            };
        });
    }

    assignDeviceWithoutTransaction(deviceId, childId) {
        const child = this.database.prepare(
            "SELECT id FROM children WHERE id = ?",
        ).get(requireText(childId, "childId"));
        if (!child) {
            throw new Error(`Child not found: ${childId}`);
        }
        const result = this.database.prepare(
            "UPDATE devices SET child_id = ? WHERE id = ?",
        ).run(childId, requireText(deviceId, "deviceId"));
        if (result.changes !== 1) {
            throw new Error(`Device not found: ${deviceId}`);
        }
    }
}

module.exports = {
    ClassMateDatabase,
    configureConnection,
    decodeCursor,
    encodeCursor,
};
