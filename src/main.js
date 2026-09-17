import * as Cesium from 'cesium';
import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { createRealtimeBackend } from './voice/realtimeBackend.js';
import {
  loadPlatformConfig,
  createCdVoiceTransport,
  createUnavailableVoiceTransport,
} from './cd/platformConfig.js';
import { installCdEndpointRewrite } from './cd/endpointMap.js';

// CD: CesiumJS ships with a built-in demo ion token and falls back to it for any
// ion-backed asset. Blank it before anything touches Cesium so no code path can
// silently spend someone else's ion quota from a hosted site.
Cesium.Ion.defaultAccessToken = '';

function reportFailure(error) {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  if (!loaderStatus) return;
  loaderStatus.textContent = `Error: ${describeError(error)}`;
  loaderStatus.style.color = '#ff4444';
}

// CD: upstream reads its credentials from import.meta.env, baked in at build
// time. This deployment ships none and asks the platform instead, so one bundle
// serves everyone and capabilities differ per visitor. loadPlatformConfig never
// rejects, so a platform that is down or slow still yields a public globe on
// Esri rather than a blank page.
const application = loadPlatformConfig().then((config) => {
  // Exposed so later phases can read what the platform enabled without fetching
  // it again. Frozen because it is shared, not owned.
  window.__cdGlobeConfig = Object.freeze(config);

  // Send upstream's dev-server API paths to the platform's equivalents. Done
  // before the application is constructed so no module captures the unwrapped
  // fetch, and driven by config.endpoints so a layer the platform has not
  // enabled is simply not rewritten: it fails the way it already would rather
  // than being pointed at an endpoint that would 503.
  installCdEndpointRewrite(config.endpoints);

  // An empty key is what marks the photoreal basemap unavailable, with the
  // reason already surfaced by upstream's map source registry. A visitor who is
  // not allowlisted simply never receives one.
  const googleApiKey = config.googleMapsKey || '';

  // The mic is offered only when the platform says voice is available AND names
  // where to mint a session, so it is never wired to an endpoint that would
  // refuse it. The tier request becomes an authenticated POST; see
  // createCdVoiceTransport for why the cookie is not accepted there.
  // A backend is always supplied, never left to default: upstream's default
  // points at its dev-server path, which this platform does not serve, so the
  // mic would report a 404 instead of a reason.
  const voiceSession = config.endpoints?.voiceSession;
  const voice = {
    backend:
      config.voice && voiceSession
        ? createRealtimeBackend({
            tokenEndpoint: voiceSession,
            tokenTransport: createCdVoiceTransport(),
          })
        : createRealtimeBackend({
            tokenTransport: createUnavailableVoiceTransport(),
          }),
  };

  const app = createStandaloneApplication({
    googleApiKey,
    // Never a token. The ion Community plan does not cover a hosted site, and
    // an empty value is also what selects the keyless terrain.
    cesiumToken: '',
    voice,
    allowQaRegistration: import.meta.env.DEV,
  });
  return app.start().then(() => app);
});

application.catch(reportFailure);

export { application };
