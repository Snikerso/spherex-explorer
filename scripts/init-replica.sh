#!/usr/bin/env bash
set -euo pipefail
mongosh --host mongodb:27017 --quiet --eval '
  try { rs.status(); }
  catch (error) {
    if (error.code !== 94) throw error;
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb:27017" }] });
  }
'
for attempt in {1..60}; do
  if mongosh --host mongodb:27017 --quiet --eval 'db.hello().isWritablePrimary ? quit(0) : quit(1)'; then
    exit 0
  fi
  sleep 1
done
echo 'MongoDB replica set nie uzyskał roli primary.' >&2
exit 1
