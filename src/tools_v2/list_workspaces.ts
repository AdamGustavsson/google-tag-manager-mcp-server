import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const list_workspaces = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "list_workspaces",
    "Lists all workspaces that belong to a Google Tag Manager container",
    {
      account_id: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the workspaces.",
        ),
      container_id: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the workspaces.",
        ),
      page_token: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({ account_id, container_id, page_token }): Promise<CallToolResult> => {
      log(
        `Running tool: list_workspaces for account ${account_id}, container ${container_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.workspaces.list({
          parent: `accounts/${account_id}/containers/${container_id}`,
          pageToken: page_token,
        });

        // Filter out unnecessary fields from each workspace
        const filteredWorkspaces = response.data.workspace?.map(workspace => {
          const {
            path,
            accountId,
            containerId,
            fingerprint,
            tagManagerUrl,
            ...rest
          } = workspace;
          return rest;
        }) || [];

        return {
          content: [
            { type: "text", text: JSON.stringify({ workspace: filteredWorkspaces }, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing workspaces in container ${container_id} for account ${account_id}`,
          error,
        );
      }
    },
  );
}; 