const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_MIGRATIONS_DIRECTORY = path.resolve(__dirname, "../migrations");

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

function migrationFiles(migrationsDirectory) {
    return fs.readdirSync(migrationsDirectory)
        .filter((fileName) => /^\d+_[a-z0-9_]+\.sql$/.test(fileName))
        .sort();
}

function configureConnection(database) {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA synchronous = NORMAL;");
}

function migrateDatabase(database, migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY) {
    database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        ) STRICT;
    `);

    const applied = new Map(
        database.prepare("SELECT version, checksum FROM schema_migrations").all()
            .map((row) => [row.version, row.checksum]),
    );

    for (const fileName of migrationFiles(migrationsDirectory)) {
        const version = fileName.split("_", 1)[0];
        const sql = fs.readFileSync(path.join(migrationsDirectory, fileName), "utf8");
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");

        if (applied.has(version)) {
            if (applied.get(version) !== checksum) {
                throw new Error(`Migration ${version} checksum does not match the applied migration`);
            }
            continue;
        }

        database.exec("BEGIN IMMEDIATE;");
        try {
            database.exec(sql);
            database.prepare(
                "INSERT INTO schema_migrations(version, checksum, applied_at) VALUES (?, ?, ?)",
            ).run(version, checksum, new Date().toISOString());
            database.exec("COMMIT;");
        } catch (error) {
            database.exec("ROLLBACK;");
            throw error;
        }
    }
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
    constructor(databasePath, options = {}) {
        this.databasePath = path.resolve(databasePath);
        fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
        this.database = new DatabaseSync(this.databasePath);
        configureConnection(this.database);
        migrateDatabase(this.database, options.migrationsDirectory || DEFAULT_MIGRATIONS_DIRECTORY);
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
        return mapParent(this.database.prepare(`
            SELECT id, code, name, surname
            FROM parents
            WHERE code = ? COLLATE NOCASE AND active = 1
        `).get(requireText(code, "code")));
    }

    listAssociatedChildren(code) {
        return this.database.prepare(`
            SELECT c.id, c.name, c.surname
            FROM parents p
            JOIN parent_child pc ON pc.parent_id = p.id AND pc.active = 1
            JOIN children c ON c.id = pc.child_id AND c.active = 1
            WHERE p.code = ? COLLATE NOCASE AND p.active = 1
            ORDER BY c.surname, c.name, c.id
        `).all(requireText(code, "code")).map(mapChild);
    }

    isAssociated(code, childId) {
        return Boolean(this.database.prepare(`
            SELECT 1
            FROM parents p
            JOIN parent_child pc ON pc.parent_id = p.id AND pc.active = 1
            JOIN children c ON c.id = pc.child_id AND c.active = 1
            WHERE p.code = ? COLLATE NOCASE AND p.active = 1 AND c.id = ?
        `).get(requireText(code, "code"), requireText(childId, "childId")));
    }

    getChildStatus(code, childId) {
        if (!this.isAssociated(code, childId)) {
            return null;
        }

        const row = this.database.prepare(`
            SELECT c.id, c.name, c.surname,
                   e.type, e.received_at, e.device_id, e.event_id
            FROM children c
            LEFT JOIN attendance_events e ON e.rowid = (
                SELECT rowid FROM attendance_events
                WHERE child_id = c.id
                ORDER BY received_at DESC, rowid DESC
                LIMIT 1
            )
            WHERE c.id = ? AND c.active = 1
        `).get(childId);

        return {
            child: mapChild(row),
            confirmedState: row.type === null ? null : row.type === "entry" ? "inside" : "outside",
            confirmedAt: row.received_at,
            sourceDeviceId: row.device_id,
            lastEventId: row.event_id,
        };
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

    getActiveAssignmentByDevice(deviceId) {
        const row = this.database.prepare(`
            SELECT d.id AS device_id, d.child_id, d.firmware_version,
                   c.name AS child_name, c.surname AS child_surname
            FROM devices d
            JOIN children c ON c.id = d.child_id AND c.active = 1
            WHERE d.id = ? AND d.active = 1 AND d.child_id IS NOT NULL
        `).get(requireText(deviceId, "deviceId"));

        return row ? {
            deviceId: row.device_id,
            childId: row.child_id,
            firmwareVersion: row.firmware_version,
            childName: row.child_name,
            childSurname: row.child_surname,
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

    assignDevice(deviceId, childId) {
        return this.transaction(() => {
            const child = this.database.prepare(
                "SELECT id FROM children WHERE id = ? AND active = 1",
            ).get(requireText(childId, "childId"));
            if (!child) {
                throw new Error(`Active child not found: ${childId}`);
            }

            const result = this.database.prepare(`
                UPDATE devices
                SET child_id = ?, active = 1
                WHERE id = ?
            `).run(childId, requireText(deviceId, "deviceId"));
            if (result.changes !== 1) {
                throw new Error(`Device not found: ${deviceId}`);
            }
            return this.getActiveAssignmentByDevice(deviceId);
        });
    }

    updateDeviceState(state) {
        const deviceId = requireText(state.deviceId, "deviceId");
        const lastReceivedAt = requireText(state.lastReceivedAt, "lastReceivedAt");
        const lastBootId = requireText(state.lastBootId, "lastBootId");
        const lastSequence = requireInteger(state.lastSequence, "lastSequence");

        return this.transaction(() => {
            if (!this.getActiveAssignmentByDevice(deviceId)) {
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

            const assignment = this.getActiveAssignmentByDevice(deviceId);
            if (!assignment || assignment.childId !== childId) {
                throw new Error(`Device ${deviceId} is not actively assigned to child ${childId}`);
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
            SELECT event_id, topic, payload, attempts
            FROM event_outbox
            WHERE published_at IS NULL
            ORDER BY event_id
            LIMIT ?
        `).all(Math.min(requireInteger(limit, "limit", 1), 500)).map((row) => ({
            eventId: row.event_id,
            topic: row.topic,
            payload: JSON.parse(row.payload),
            attempts: row.attempts,
        }));
    }

    markOutboxPublished(eventId, publishedAt) {
        const result = this.database.prepare(`
            UPDATE event_outbox
            SET published_at = ?, attempts = attempts + 1
            WHERE event_id = ?
        `).run(requireText(publishedAt, "publishedAt"), requireText(eventId, "eventId"));
        return result.changes === 1;
    }

    provision(seed) {
        return this.transaction(() => {
            const upsertParent = this.database.prepare(`
                INSERT INTO parents(id, code, name, surname, active)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    code = excluded.code, name = excluded.name,
                    surname = excluded.surname, active = excluded.active
            `);
            const upsertChild = this.database.prepare(`
                INSERT INTO children(id, name, surname, active)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name, surname = excluded.surname, active = excluded.active
            `);
            const upsertAssociation = this.database.prepare(`
                INSERT INTO parent_child(parent_id, child_id, active)
                VALUES (?, ?, ?)
                ON CONFLICT(parent_id, child_id) DO UPDATE SET active = excluded.active
            `);
            const upsertDevice = this.database.prepare(`
                INSERT INTO devices(id, child_id, active, firmware_version)
                VALUES (?, NULL, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    active = excluded.active, firmware_version = excluded.firmware_version
            `);
            const upsertConfiguration = this.database.prepare(`
                INSERT INTO system_config(key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `);

            for (const parent of seed.parents || []) {
                upsertParent.run(parent.id, parent.code, parent.name, parent.surname, parent.active === false ? 0 : 1);
            }
            for (const child of seed.children || []) {
                upsertChild.run(child.id, child.name, child.surname, child.active === false ? 0 : 1);
            }
            for (const association of seed.associations || []) {
                upsertAssociation.run(
                    association.parentId,
                    association.childId,
                    association.active === false ? 0 : 1,
                );
            }
            for (const device of seed.devices || []) {
                upsertDevice.run(
                    device.id,
                    device.active === false ? 0 : 1,
                    device.firmwareVersion || null,
                );
            }
            for (const device of seed.devices || []) {
                if (device.childId) {
                    this.assignDeviceWithoutTransaction(device.id, device.childId);
                }
            }
            for (const [key, value] of Object.entries(seed.broker || {})) {
                upsertConfiguration.run(`mqtt.${key}`, String(value));
            }

            return {
                parents: (seed.parents || []).length,
                children: (seed.children || []).length,
                associations: (seed.associations || []).length,
                devices: (seed.devices || []).length,
                brokerSettings: Object.keys(seed.broker || {}).length,
            };
        });
    }

    assignDeviceWithoutTransaction(deviceId, childId) {
        const child = this.database.prepare(
            "SELECT id FROM children WHERE id = ? AND active = 1",
        ).get(requireText(childId, "childId"));
        if (!child) {
            throw new Error(`Active child not found: ${childId}`);
        }
        const result = this.database.prepare(
            "UPDATE devices SET child_id = ?, active = 1 WHERE id = ?",
        ).run(childId, requireText(deviceId, "deviceId"));
        if (result.changes !== 1) {
            throw new Error(`Device not found: ${deviceId}`);
        }
    }
}

module.exports = {
    ClassMateDatabase,
    DEFAULT_MIGRATIONS_DIRECTORY,
    configureConnection,
    decodeCursor,
    encodeCursor,
    migrateDatabase,
};
