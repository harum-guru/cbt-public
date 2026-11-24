import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

// Prevent recursive invocation when package.json "build" runs opennextjs-cloudflare build
config.buildCommand = "next build";

export default config;
