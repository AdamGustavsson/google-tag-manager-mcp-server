import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import { createErrorResponse, getTagManagerClient, log } from "../utils";

export const list_accounts = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "list_accounts",
    "Lists all Google Tag Manager accounts accessible by the authenticated user",
    {},
    async (): Promise<CallToolResult> => {
      log("Running tool: list_accounts");

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.list({});

        // Filter out unnecessary fields from each account
        const filteredAccounts = response.data.account?.map(account => {
          const { path, features, ...rest } = account;
          return rest;
        }) || [];

        return {
          content: [
            { type: "text", text: JSON.stringify({ account: filteredAccounts }, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse("Error listing accounts", error);
      }
    },
  );
}; 