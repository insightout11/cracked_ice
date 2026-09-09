# Deprecated player directory

`players.json` in this folder is a historical snapshot and is intentionally not read by the application.
The canonical directory is `apps/api/src/data/players.json`; `data/players.json` is its deployment copy.
Run `node scripts/validate-player-directories.mjs` to verify their identity fields remain equal.
