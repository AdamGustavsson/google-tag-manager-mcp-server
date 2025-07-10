import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const sync_workspace = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "sync_workspace",
    "Syncs a workspace to the latest container version",
    {
      account_id: z
        .string()
        .describe("The unique ID of the GTM Account containing the workspace."),
      container_id: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the workspace.",
        ),
      workspace_id: z
        .string()
        .describe("The unique ID of the GTM Workspace to sync."),
    },
    async ({
      account_id,
      container_id,
      workspace_id,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: sync_workspace for account ${account_id}, container ${container_id}, workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.workspaces.sync({
          path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error syncing workspace ${workspace_id} in container ${container_id} for account ${account_id}`,
          error,
        );
      }
    },
  );
}; 