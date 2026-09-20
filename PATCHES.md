# Patches against upstream

This fork tracks `bilawalsidhu/gods-eye-view` (see `VERSION` for the base SHA).
Every divergence from upstream is listed here so merging upstream fixes stays
manageable. Keep this file current: if you change an upstream file, add a row.

Rule of thumb for this fork: prefer the smallest possible diff in upstream files,
and put new behaviour in new files where you can. Two of the four changes below
are deletions of a call site rather than edits to the thing being disabled, for
exactly that reason.

## Why this fork exists

Upstream is built to run locally: a Vite dev server with provider middleware, an
in-app panel for pasting API keys, and credentials injected into the bundle at
build time. Catastrophic Disclosure hosts it publicly at `/globe/`, so the keys
have to move server-side and the key-entry UI has to go.

## Changed upstream files

| File | Change | Why |
|---|---|---|
| `server/standalone/vite.config.js` | Set `base: '/globe/'`. Pass `googleApiKey: ''` and `cesiumToken: ''` instead of reading them from `process.env`. | The bundle is served under a path prefix, and no provider credential may be baked into a public bundle. The Google key is delivered at runtime by `GET /api/globe/config` to allowlisted users only. |
| `src/main.js` | Import Cesium and set `Cesium.Ion.defaultAccessToken = ''` before creating the application. Pass empty strings for both keys. | CesiumJS carries a built-in demo ion token and falls back to it for ion-backed assets. Blanking it means no code path can quietly spend ion quota from a hosted site. The ion Community plan is personal and non-commercial and does not cover this deployment. |
| `src/standalone/startupChrome.js` | Stop passing `initializeSettings: initKeySetup`. | Removes the POWER UP / Provider Settings panel, which writes provider keys to local disk. `startApplicationChrome` calls `initializeSettings` optionally, so dropping the argument leaves `src/keySetup.js` unreferenced and Vite tree-shakes it out. The file itself is untouched, which keeps the diff to two lines. |
| `index.html` | Drop the `<!-- gev:template provider-settings -->` marker. | Consequence of the line above. Upstream's `keySetup.js` deletes that markup at runtime when `/api/setup/status` does not answer, but this fork never starts it, so the dead chip and dialog would otherwise sit in the served page. Removing the marker keeps them out of the build entirely. |
| `server/providers/local.js` | Remove the `keySetupEndpoint()` import and its entry in the plugin list. | The endpoint that panel posted to. Removed from local dev as well, so no build of this fork can write a key file. |
| `build/cesium-base-path-fix.js` | New file. Wraps `vite-plugin-cesium` and relocates its asset copy. | **Load-bearing: without it the globe does not boot.** The plugin builds `CESIUM_BASE_URL` by joining `base`, which is right for the URL in `index.html`, then reuses that same string as a filesystem path. Under `base: '/globe/'` the page requests `/globe/cesium/Cesium.js` while the files land in `dist/globe/cesium/`, so every Cesium asset 404s. The correction has to chain off the plugin's own `closeBundle`, because `closeBundle` is a parallel Rollup hook and a sibling plugin races the copy instead of following it. |
| `build/vite.js` | Wrap the `cesium()` call in `withCesiumBasePathFix(...)`. | Call site for the above. |
| `src/cd/platformConfig.js` | New file. Fetches `GET /api/globe/config` and adapts the voice token request to CD's endpoint. | The whole point of the fork: capability comes from the platform at runtime instead of from `import.meta.env` at build time, so one public bundle serves anonymous and allowlisted visitors differently. Fails soft in every direction, because the anonymous tier is the floor rather than an error state. |
| `src/main.js` | Await the platform config, then pass `googleApiKey` and a voice `backend` built from it. | Bootstrap for the above. Also always supplies a backend rather than letting it default, since upstream's default token endpoint is a dev-server path this platform does not serve. |
| `src/cd/platformConfig.test.mjs` | New file. | Covers the fail-soft paths, that `voice` honours only a literal `true`, and that the voice request is a header-authenticated POST with `credentials: 'omit'`. |
| `src/logoGaze.js`, `src/voice/control.js`, `src/ui/styles/command-dock-trays.css` | Resolve `logo.svg`, `mic.svg`, `location.svg` and `visual-presets.svg` against the base path. | **Found by loading the deployed page, not by reading code.** Upstream hardcodes root-absolute public asset paths. Vite rewrites those in the HTML attributes it parses, but not in JS strings, not in `data-*` attributes it does not know about, and not in root-absolute CSS `url()`. Under `base: '/globe/'` each of those escapes to the platform root and 404s. JS uses `import.meta.env.BASE_URL`; the CSS masks use `../`, since the bundled stylesheet sits at `/globe/assets/`. |
| `src/cd/endpointMap.js` + one call in `src/main.js` | New file. Rewrites upstream's dev-server API paths to the platform's `/api/globe/...` equivalents. | Upstream calls paths its Vite middleware serves; that middleware is not deployed, so on the platform they 404. The platform serves the same data in the same shapes. Rewriting in one table beats patching every call site, several of which build their URL inline in files upstream keeps changing. Driven by `config.endpoints`, so a layer the platform has not enabled is deliberately NOT rewritten and fails as it already would rather than being pointed somewhere that 503s. |
| `scripts/package-boundaries.json` | Add `build/cesium-base-path-fix.js` to the `vite-build` package. | `npm run check:boundaries` fails on an unowned module otherwise. |
| `src/googleServerKey.test.mjs` | Invert the browser-defines assertion, and add a `base` assertion. | Upstream asserts that `GOOGLE_MAPS_API_KEY` from the environment reaches the browser bundle. This fork asserts the opposite, that no credential is ever baked in whatever the environment holds, which doubles as a regression guard: if an upstream merge restores the env read, this test fails. |

## Deliberately NOT changed

- `src/maps/defaultSources.js`. Upstream already defaults to Esri World Imagery,
  falls back to OSM on both construction failure and repeated tile failure, uses
  `createKeylessTerrain` when no ion token is present, and marks ion basemaps
  unavailable with a reason. That is exactly the behaviour this deployment wants,
  so it is inherited rather than patched.
- `src/keySetup.js`, `src/keySetupCore.mjs`. Left in place. `keySetupCore.mjs` is
  still imported by the map and layer UI for its "what key does this need"
  strings, and the panel itself is already excluded from the bundle by the call
  site change above.
- `server/` generally. It is Vite dev-server middleware, not a deployable server,
  and it is not part of the production build. It stays so local `npm run dev`
  keeps working against upstream providers while the CD endpoints are built.

## CD follow-up pass (2026-09-20)

- **Cameras layer source label: `CCTV + Street View fallback` -> `CCTV`.**
  `src/layers/cctv/controls.js`. The Street View fallback is not ported. The
  platform's frame proxy serves upstream snapshots only, from an allowlist of
  three hosts, and 404s when there is none. The old label advertised a
  behaviour this deployment deliberately does not have, and a viewer seeing a
  placeholder would have assumed it came from Street View.

- **Mapped Installations and Mapped ALPR Cameras hidden from the layer panel.**
  `src/ui/layerPanel.js`, new `PANEL_HIDDEN` set. Neither backend route exists
  on the platform: the first needs `GET /api/military-installations`, the
  second `POST /api/overpass`. Both controls would otherwise sit in the panel
  reporting a failed fetch. Hidden rather than removed, because the layers
  themselves are fine and only the backend is missing, so re-enabling one is
  deleting its id from that set.

- **HUD classification banner and mission designator replaced.**
  `src/hud.js`. `TOP SECRET // SI-TK // NOFORN` (twice, the top bar and the
  top-left corner block) becomes `UNCLASSIFIED // OPEN SOURCE // PUBLIC DATA`,
  and the `KH11-` mission id becomes `CD-GLOBE-`. KH-11 is a real NRO
  reconnaissance satellite programme, and the markings are real control
  markings. This renders open-source data on a public site under the operator's
  own name, so carrying either was a false claim about the data and its
  provenance. A sweep of the visual styles, military HUD, scene director and
  recording mode found no other real markings or programme names; the remaining
  `OPS-41xx` sensor id, orbit and pass numbers are invented telemetry and were
  left alone.

## Pending, not yet applied

- **Root-absolute paths to `/models/*.glb` (29 references).** Left alone. They
  are still bare `/models/...` in the bundle, and the earlier note here
  predicted they would 404 under a non-root base. Production says otherwise:
  with the military layer live, the deploy log shows
  `GET /globe/models/jet.glb 200`, and `jet.glb` is one of the bare
  references. Something in the model load path resolves them against the base
  after all. The mechanism has not been traced, so this stays recorded rather
  than "fixed": if a model ever does 404, this is the first place to look.


- Layer registry gating. `config.layers` is fetched and exposed on
  `window.__cdGlobeConfig`, but nothing consumes it yet: the basemap ladder and
  the mic are driven by the config, the layer list is not. It becomes meaningful
  in CD spec Phase 6, when `flights`, `military` and `satellites` gain real
  endpoints. Until then only `earthquakes` works, because that module fetches
  USGS directly with no CD hop, and the other layers have no backend to call in
  a production bundle.
