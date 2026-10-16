import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
// AUDIO_ONLY=1: only the voice track (a WAV), to remux after a change to the voice alone
if (!process.env.AUDIO_ONLY) {
  Config.setCodec("h264");
  Config.setCrf(16);
  Config.setPixelFormat("yuv420p");
}
Config.setConcurrency(2);
// Bound the decoded-frame cache: this machine has 15 GB and a browser open.
Config.setOffthreadVideoCacheSizeInBytes(768 * 1024 * 1024);
