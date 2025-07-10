import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const list_containers = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "list_containers",
    "Lists all containers within the specified Google Tag Manager account",
    {
      account_id: z
        .string()
        .describe(
          "The unique ID of the GTM Account whose containers will be listed.",
        ),
    },
    async ({ account_id }): Promise<CallToolResult> => {
      log(`Running tool: list_containers for account ${account_id}`);

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.list({
          parent: `accounts/${account_id}`,
        });

        // Filter out unnecessary fields from each container
        const filteredContainers = response.data.container?.map(container => {
          const {
            usageContext,
            fingerprint,
            tagManagerUrl,
            features,
            tagIds,
            path,
            accountId,
            ...rest
          } = container;
          return rest;
        }) || [];

        return {
          content: [
            { type: "text", text: JSON.stringify({ container: filteredContainers }, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing containers for account ${account_id}`,
          error,
        );
      }
    },
  );
}; 