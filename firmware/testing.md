## view atttendance events for a childv

```sh
watch -n 2 'docker exec classmate-iot-node-red-1 node -e "const {DatabaseSync}=require(\"node:sqlite\"); const db=new DatabaseSync(\"/data/sqlite/classmate.db\",{readOnly:true}); console.table(db.prepare(\"SELECT * FROM attendance_events WHERE child_id=? ORDER BY received_at DESC\").all(\"child-001\")); db.close()"'
```
# view outbox events for a child

```sh
watch -n 2 'docker exec classmate-iot-node-red-1 node -e "const {DatabaseSync}=require(\"node:sqlite\"); const db=new DatabaseSync(\"/data/sqlite/classmate.db\",{readOnly:true}); console.table(db.prepare(\"SELECT event_id, published_at, topic, payload FROM event_outbox WHERE topic=? ORDER BY rowid DESC\").all(\"classmate/v1/children/child-001/events\")); db.close()"'
```



```sh
./infra/scripts/compose.sh restart node-red
```

```sh
infra/scripts/compose.sh logs -f node-red
```

```sh
infra/scripts/compose.sh stop mosquitto
