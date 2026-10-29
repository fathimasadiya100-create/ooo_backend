# Odd One Out — Netlify deployment

This package preserves the existing game hub and routes production multiplayer requests through `/.netlify/functions/game`. The function stores room state in Netlify Blobs using strong consistency and conditional writes (`onlyIfMatch` for room updates, `onlyIfNew` for room creation).

## Deploy

1. Unzip this project folder first. While signed in to Netlify, use its project-folder drag-and-drop flow so Netlify detects the project and runs the build. A plain static-output upload will not compile the function.
2. The build command is `npm run build`; the publish folder is `dist`.
3. Netlify Functions and Blobs must be available to the site. Blobs is initialized automatically for deployed functions. The build environment needs registry access to install `@netlify/blobs`.
4. Open the deployed site in two separate browsers/devices, create a room in one, join with its four-character code in the other, and start the game from the host.

## Important notes

- Dot to Domination is a single puzzle round, not a three-round mode. The intended puzzle is a 6×6 grid with 8 checkpoints and a 120-second solving timer, following a short start countdown.
- Local development continues to use the original Socket.IO server. Production builds use the Netlify Function polling transport.
- Netlify Blobs conditional writes prevent a stale room snapshot from overwriting a newer one, but Blobs is not a transactional database. If this game grows substantially, a transactional database is safer for high-concurrency score updates.
- This workspace could not reach the npm registry, so the existing lockfile was retained and its root dependency metadata updated; the complete dependency tree could not be regenerated here. Netlify should reconcile it during `npm install`, but a clean install/build was not verified in this workspace.
- A local build does not verify live Netlify Blobs or deployed multiplayer behavior. Test two real browser sessions after deployment.
