import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { registerTools } from "./tools_v2";
import { apisHandler, getPackageVersion } from "./utils";

export class GoogleTagManagerMCPServer extends McpAgent<
  Env,
  null,
  McpAgentPropsModel
> {
  server = new McpServer({
    name: "google-tag-manager-mcp-server",
    version: getPackageVersion(),
    protocolVersion: "1.0",
    vendor: "stape-io",
    homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
  });

  async init() {
    registerTools(this.server, { props: this.props, env: this.env });
  }
}

export default new OAuthProvider({
  // Protect both SSE and Streamable HTTP endpoints
  apiHandlers: {
    // Use built-in SSE transport from agents/mcp (now supports absolute endpoint)
    "/sse": GoogleTagManagerMCPServer.serve("/sse") as any,
    // Streamable HTTP transport for MCP (POST + SSE response)
    // Uses built-in streamable transport from agents/mcp
    "/streamable-http": GoogleTagManagerMCPServer.serve("/streamable-http") as any,
  },
  // @ts-ignore
  defaultHandler: apisHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  // Keep Google tokens fresh by syncing during token grants/refreshes
  tokenExchangeCallback: async (options) => {
    try {
      // On refresh_token, rotate upstream Google access token using stored refresh token
      if (options.grantType === "refresh_token") {
        const refreshToken = (options.props as any)?.refreshToken as
          | string
          | undefined;
        if (!refreshToken) return;

        const upstreamUrl = "https://oauth2.googleapis.com/token";
        const body = new URLSearchParams({
          client_id: (options.props as any)?.googleClientId || "",
          client_secret: (options.props as any)?.googleClientSecret || "",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });

        const resp = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        if (!resp.ok) {
          console.error("Failed to refresh upstream Google token", await resp.text());
          return;
        }
        const json = (await resp.json()) as {
          access_token: string;
          expires_in?: number;
          refresh_token?: string;
        };

        return {
          accessTokenProps: {
            ...(options.props as any),
            accessToken: json.access_token,
          },
          newProps: {
            ...(options.props as any),
            accessToken: json.access_token,
            // Google may omit refresh_token on refresh; keep the old one if missing
            refreshToken: json.refresh_token || refreshToken,
          },
          accessTokenTTL: json.expires_in,
        } as any;
      }

      // On initial exchange, ensure tokens TTL aligns with Google if provided in props
      if (options.grantType === "authorization_code") {
        return {
          accessTokenProps: options.props,
          newProps: options.props,
        } as any;
      }
    } catch (e) {
      console.error("tokenExchangeCallback error", e);
    }
  },
});
