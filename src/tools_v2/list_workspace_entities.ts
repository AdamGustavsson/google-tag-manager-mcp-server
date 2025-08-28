import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const list_workspace_entities = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "list_workspace_entities",
    "Lists all tags, triggers, and variables in a Google Tag Manager workspace",
    {
      account_id: z
        .string()
        .describe("The unique ID of the GTM Account."),
      container_id: z
        .string()
        .describe("The unique ID of the GTM Container."),
      workspace_id: z
        .string()
        .describe("The unique ID of the GTM Workspace."),
    },
    async ({ account_id, container_id, workspace_id }): Promise<CallToolResult> => {
      log(
        `Running tool: list_workspace_entities for account ${account_id}, container ${container_id}, workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const parent = `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`;

        // Fetch all entities in parallel
        const [tagsResponse, triggersResponse, variablesResponse] = await Promise.all([
          tagmanager.accounts.containers.workspaces.tags.list({ parent }),
          tagmanager.accounts.containers.workspaces.triggers.list({ parent }),
          tagmanager.accounts.containers.workspaces.variables.list({ parent }),
        ]);

        // Extract tagId, name, and type from tags
        const tags =
          tagsResponse.data.tag?.map(tag => ({
            tagId: tag.tagId,
            name: tag.name,
            type: tag.type,
            triggerIds: tag.firingTriggerId ?? [],
          })) || [];

        // Extract triggerId, name, and type (event type) from triggers
        const triggers =
          triggersResponse.data.trigger?.map(trigger => ({
            triggerId: trigger.triggerId,
            name: trigger.name,
            type: trigger.type,
          })) || [];

        // Extract variableId, name, and type from variables
        const variables =
          variablesResponse.data.variable?.map(variable => ({
            variableId: variable.variableId,
            name: variable.name,
            type: variable.type,
          })) || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  tags,
                  triggers,
                  variables,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing entities in workspace ${workspace_id} for container ${container_id} in account ${account_id}`,
          error,
        );
      }
    },
  );
}; 
