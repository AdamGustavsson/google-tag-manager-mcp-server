import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import Schema$Workspace = tagmanager_v2.Schema$Workspace;
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const create_workspace = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "create_workspace",
    "Creates a new workspace in a Google Tag Manager container",
    {
      account_id: z.string().describe("The GTM Account ID."),
      container_id: z.string().describe("The GTM Container ID."),
      name: z.string().describe("Workspace display name."),
      description: z.string().optional().describe("Workspace description."),
    },
    async ({ account_id, container_id, name, description }): Promise<CallToolResult> => {
      log(
        `Running tool: create_workspace for account ${account_id}, container ${container_id}`,
      );
      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.workspaces.create(
          {
            parent: `accounts/${account_id}/containers/${container_id}`,
            requestBody: {
              name,
              description,
            } as Schema$Workspace,
          },
        );

        // Extract only the workspaceId from the response
        const { workspaceId } = response.data;

        return {
          content: [
            { type: "text", text: JSON.stringify({ workspaceId }, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating workspace in container ${container_id} for account ${account_id}`,
          error,
        );
      }
    },
  );
}; 