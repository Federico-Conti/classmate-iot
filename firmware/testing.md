## view atttendance events for a childv

```sh
watch -n 2 'docker exec classmate-iot-node-red-1 node -e "const {DatabaseSync}=require(\"node:sqlite\"); const db=new DatabaseSync(\"/data/sqlite/classmate.db\",{readOnly:true}); console.table(db.prepare(\"SELECT * FROM attendance_events WHERE child_id=? ORDER BY received_at DESC\").all(\"child-001\")); db.close()"'
```


```sh
./infra/scripts/compose.sh restart node-red
```