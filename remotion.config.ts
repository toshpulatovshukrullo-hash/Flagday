import { Config } from '@remotion/cli/config';

// Software GL (SwiftShader via ANGLE) works headless on Linux & Windows without a GPU.
// On a Windows machine with a GPU you can switch to 'angle' for much faster renders.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setConcurrency(2);
Config.setTimeoutInMilliseconds(240000);
// Use a locally installed Chromium if REMOTION_BROWSER is set (e.g. in sandboxes without download access).
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
