CREATE TABLE parents (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
) STRICT;

CREATE TABLE children (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
) STRICT;

CREATE TABLE parent_child (
    parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    PRIMARY KEY (parent_id, child_id)
) STRICT;

CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    child_id TEXT REFERENCES children(id) ON DELETE RESTRICT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    firmware_version TEXT,
    active_child_id TEXT GENERATED ALWAYS AS (
        CASE WHEN active = 1 THEN child_id ELSE NULL END
    ) STORED UNIQUE
) STRICT;

CREATE TABLE device_state (
    device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    last_received_at TEXT NOT NULL,
    last_boot_id TEXT NOT NULL,
    last_sequence INTEGER NOT NULL CHECK (last_sequence >= 0),
    UNIQUE (device_id, last_boot_id, last_sequence)
) STRICT;

CREATE TABLE presence_state (
    child_id TEXT PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
    confirmed_state TEXT NOT NULL CHECK (confirmed_state IN ('inside', 'outside')),
    confirmed_at TEXT NOT NULL,
    source_device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    last_event_id TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE attendance_events (
    event_id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('entry', 'exit')),
    occurred_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    weighted_rssi REAL CHECK (weighted_rssi IS NULL OR weighted_rssi BETWEEN -127 AND 0),
    evidence_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence_json))
) STRICT;

CREATE TABLE event_outbox (
    event_id TEXT PRIMARY KEY REFERENCES attendance_events(event_id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    payload TEXT NOT NULL CHECK (json_valid(payload)),
    published_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
) STRICT;

CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;
