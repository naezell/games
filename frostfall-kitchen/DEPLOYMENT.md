# Frostfall Kitchen & Mill release

This release targets the existing `frostfall-kitchen` Cloudflare Worker. It uses the current compatibility date and has no resource bindings. The build combines the game into one Worker module for the existing API upload workflow.

## Build and inspect locally

From the repository root, use Node.js 20 or newer.

```sh
node frostfall-kitchen/build.mjs
node --test frostfall-kitchen/test/*.test.mjs frostfall-kitchen/cloudflare/worker.test.mjs
node frostfall-kitchen/cloudflare/serve.mjs 8080
```

Open [http://127.0.0.1:8080/](http://127.0.0.1:8080/). Check the map and operations controls, then open [Classic](http://127.0.0.1:8080/classic/) and verify it loads on the same origin. The server runs the packaged Worker handler, including its production content security policies.

The build writes `frostfall-kitchen/dist/worker.mjs` and `metadata.json`. The root and `/works/` serve the operations game. The `/classic/` route serves the previous playable game and uses its original browser save keys. Changing paths on the existing host keeps Classic's storage accessible. Local tests and separate preview hosts have their own browser storage.

Three.js is vendored from the pinned r128 CDN build previously used by Classic. The same file is in the npm package `three@0.128.0`, and the corresponding MIT license ships in `works/vendor/LICENSE`. The SHA-256 of `three.min.js` is `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2`.

## Release after approval

Upload `worker.mjs` to the existing Worker as a new version using the [Cloudflare Upload Version API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/). The multipart field named `metadata` should contain `metadata.json` with content type `application/json`. The part named `worker.mjs` should use `application/javascript+module`. The upload creates a version and leaves the Worker's existing logs and traces settings in place. Cloudflare serves the version on the production hostname after promotion.

Select the new version in the Worker dashboard under **Deployments** and promote it to 100% after approval. Smoke-test `/`, `/works/`, and `/classic/` on the existing hostname. Verify that loading Classic on the same device and profile restores its prior save. Verify that a separate manual operations save reloads in the operations game.

The previously verified production version was `4a1e42b3-ef53-425d-ae79-0cbd5c27fa9d`. Confirm the active version again before promotion so it is available for [rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). The Git backup for the pre-operations game is [archive/frostfall-kitchen-2026-11-15](https://github.com/naezell/games/tree/archive/frostfall-kitchen-2026-11-15).
