import * as Cesium from 'cesium';
import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

// CD: CesiumJS ships with a built-in demo ion token and falls back to it for any
// ion-backed asset. Blank it before anything touches Cesium so no code path can
// silently spend someone else's ion quota from a hosted site.
Cesium.Ion.defaultAccessToken = '';

const application = createStandaloneApplication({
  googleApiKey: '',
  cesiumToken: '',
  allowQaRegistration: import.meta.env.DEV,
});

application.start().catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  loaderStatus.textContent = `Error: ${describeError(error)}`;
  loaderStatus.style.color = '#ff4444';
});

export { application };
