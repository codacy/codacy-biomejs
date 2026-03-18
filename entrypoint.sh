#!/bin/sh
export PATH="/app/node_modules/.bin:$PATH"
max_ram=4294967296
max_ram=$((max_ram / 1024 / 1024))
old_space_size=$((max_ram - 356))

export TS_NODE_PROJECT=/app/workspaces/codacy/tsconfig.json
exec node --max-old-space-size="$old_space_size" --max-semi-space-size=16 --gc_interval=100 --v8-pool-size=0 --use-largepages=silent --import=/app/register.js /app/workspaces/codacy/src/index.ts