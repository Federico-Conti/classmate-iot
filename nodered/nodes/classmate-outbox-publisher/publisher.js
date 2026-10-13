class OutboxPublisher {
    constructor(database, broker) {
        this.database = database;
        this.broker = broker;
        this.running = false;
        this.closed = false;
    }

    close() {
        this.closed = true;
    }

    async flush() {
        if (this.running || this.closed || !this.broker.connected || !this.broker.client) return;
        this.running = true;
        try {
            while (!this.closed && this.broker.connected) {
                const pending = this.database.listPendingOutbox(100);
                if (pending.length === 0) break;
                for (const event of pending) {
                    if (this.closed || !this.broker.connected) return;
                    await new Promise((resolve, reject) => {
                        this.broker.client.publish(event.topic, JSON.stringify(event.payload), {
                            qos: 1,
                            retain: true,
                        }, (error) => error ? reject(error) : resolve());
                    });
                    if (this.closed) return;
                    this.database.markOutboxPublished(event.eventId, new Date().toISOString());
                }
            }
        } finally {
            this.running = false;
        }
    }
}

module.exports = { OutboxPublisher };
