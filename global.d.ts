/* eslint-disable */

declare namespace Cloudflare {
  interface Env {
    OAUTH_KV: KVNamespace;
    GOOGLE_CLIENT_ID: "";
    GOOGLE_CLIENT_SECRET: "";
    COOKIE_ENCRYPTION_KEY: "";
    HOSTED_DOMAIN: "";
    WORKER_HOST: "";
    MCP_PUBLIC_BASE_URL: string;
    MCP_OBJECT: DurableObjectNamespace<import("./src/index").GoogleTagManagerMCPServer>;
  }
}
interface Env extends Cloudflare.Env {}
