# Restore verification

Source: `medimind_db` → restored copy: `medimind_restore_test`  ·  verified 2026-11-16T22:11:35.687Z

| Collection | Source | Restored | Count | 5-doc sample (deep equal) | Indexes |
|---|---:|---:|:-:|:-:|:-:|
| users | 521 | 521 | match | match | match |
| patients | 500 | 500 | match | match | match |
| doctors | 20 | 20 | match | match | match |
| appointments | 2200 | 2200 | match | match | match |
| slot_reservations | 1932 | 1932 | match | match | match |
| medical_records | 663 | 663 | match | match | match |
| medical_documents | 0 | 0 | match | match | match |
| ai_conversations | 0 | 0 | match | match | match |
| ai_messages | 0 | 0 | match | match | match |
| notifications | 682 | 682 | match | match | match |
| audit_logs | 0 | 0 | match | match | match |
| documents.files | 0 | 0 | match | match | match |
| documents.chunks | 0 | 0 | match | match | match |

JSON Schema validator on `appointments` preserved: **true**

Overall: **PASS**
