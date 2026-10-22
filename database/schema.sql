CREATE TABLE parents (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    surname TEXT NOT NULL
) STRICT;

CREATE TABLE children (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    surname TEXT NOT NULL
) STRICT;

CREATE TABLE parent_child (
    parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, child_id)
) STRICT;

CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    child_id TEXT UNIQUE REFERENCES children(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE device_state (
    device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    last_received_at TEXT NOT NULL,
    last_boot_id TEXT NOT NULL,
    last_sequence INTEGER NOT NULL CHECK (last_sequence >= 0),
    UNIQUE (device_id, last_boot_id, last_sequence)
) STRICT;

CREATE TABLE attendance_events (
    event_id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('entry', 'exit')),
    received_at TEXT NOT NULL,
    weighted_rssi REAL NOT NULL CHECK (weighted_rssi BETWEEN -127 AND 0)
) STRICT;

CREATE TABLE event_outbox (
    event_id TEXT PRIMARY KEY REFERENCES attendance_events(event_id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    payload TEXT NOT NULL CHECK (json_valid(payload)),
    published_at TEXT
) STRICT;
