import { startApplicationChrome } from '../app/startupChrome.js';
// CD: the POWER UP / Provider Settings panel is a local-dev feature that writes
// provider keys to disk. It must not exist in a hosted bundle, so no
// initializeSettings is passed. startApplicationChrome calls it optionally, which
// leaves keySetup.js unreferenced and tree-shaken out of the build.
export function startStandaloneChrome(options) {
  return startApplicationChrome({ ...options });
}
