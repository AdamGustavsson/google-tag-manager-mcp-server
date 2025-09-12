# MCP Server for Google Tag Manager

This is a server that supports remote MCP connections, with Google OAuth built-in and provides an interface to the Google Tag Manager API.

## Available Tools (v2)
- `create_update_delete_tag`: Create, update, or delete a GTM Tag. Fingerprint is handled automatically on update.
- `create_update_delete_trigger`: Create, update, or delete a GTM Trigger. Fingerprint is handled automatically on update.
- `create_update_delete_variable`: Create, update, or delete a GTM Variable. Fingerprint is handled automatically on update.
- Plus supporting tools like `list_accounts`, `list_containers`, `list_workspaces`, `create_workspace`, `sync_workspace`, `list_workspace_entities`, `get_workspace_entity`, and `publish_workspace`.

Notes on optimistic concurrency
- The Google Tag Manager API uses a `fingerprint` for update operations. The v2 tools fetch the current entity and pass its fingerprint automatically, so clients do not need to supply it.
- If an update fails due to a submitted/locked workspace, the tools will create a new workspace and retry where applicable.

## Prerequisites
- Node.js (v18 or higher)

## Configuration (Copilot Studio compatibility)

- `MCP_PUBLIC_BASE_URL`: Optional. When set, the SSE handshake emits a fully qualified endpoint using this base URL (e.g., `https://google-tag-manager-mcp-server.adam-gustavsson.workers.dev`). If not set, the server derives the base from the request origin.
- `MCP_SSE_ENDPOINT_ABSOLUTE`: Optional, default `true`. Controls whether the SSE `event: endpoint` contains an absolute URL (`true`) or a relative path (`false`). Copilot Studio requires an absolute URL.

Example (Cloudflare Workers variables):

```
MCP_PUBLIC_BASE_URL=https://google-tag-manager-mcp-server.adam-gustavsson.workers.dev
MCP_SSE_ENDPOINT_ABSOLUTE=true
```

## Access the remote MCP server from Claude Desktop

Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that controls which MCP servers Claude can access.

Replace the content with the following configuration. Once you restart Claude Desktop, a browser window will open showing your OAuth login page. Complete the authentication flow to grant Claude access to your MCP server. After you grant access, the tools will become available for you to use.

```json
{
  "mcpServers": {
    "google-tag-manager-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://gtm-mcp.stape.ai/sse"
      ]
    }
  }
}
```

### Troubleshooting

[mcp-remote](https://github.com/geelen/mcp-remote#readme) stores all the credential information inside ~/.mcp-auth (or wherever your MCP_REMOTE_CONFIG_DIR points to). If you're having persistent issues, try running:
You can run rm -rf ~/.mcp-auth to clear any locally stored state and tokens.
```
rm -rf ~/.mcp-auth
```
Then restarting your MCP client.

