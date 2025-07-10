import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const get_workspace_entity = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "get_workspace_entity",
    "Gets a specific tag, trigger, or variable from a Google Tag Manager workspace",
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
      entity_type: z
        .enum(["tag", "trigger", "variable"])
        .describe("The type of entity to retrieve."),
      entity_id: z
        .string()
        .describe("The unique ID of the entity to retrieve."),
    },
    async ({ account_id, container_id, workspace_id, entity_type, entity_id }): Promise<CallToolResult> => {
      log(
        `Running tool: get_workspace_entity for ${entity_type} ${entity_id} in workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const basePath = `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`;

        let response;
        switch (entity_type) {
          case "tag":
            response = await tagmanager.accounts.containers.workspaces.tags.get({
              path: `${basePath}/tags/${entity_id}`,
            });
            // Filter out redundant fields from tag
            const {
              path,
              accountId,
              containerId,
              workspaceId,
              fingerprint,
              tagManagerUrl,
              parentFolderId,
              monitoringMetadata,
              ...tagData
            } = response.data;
            return {
              content: [
                { type: "text", text: JSON.stringify(tagData, null, 2) },
              ],
            };

          case "trigger":
            response = await tagmanager.accounts.containers.workspaces.triggers.get({
              path: `${basePath}/triggers/${entity_id}`,
            });
            // Filter out redundant fields from trigger
            const { path: p1, accountId: a1, containerId: c1, workspaceId: w1, fingerprint: f1, tagManagerUrl: t1, ...triggerData } = response.data;
            return {
              content: [
                { type: "text", text: JSON.stringify(triggerData, null, 2) },
              ],
            };

          case "variable":
            response = await tagmanager.accounts.containers.workspaces.variables.get({
              path: `${basePath}/variables/${entity_id}`,
            });
            // Filter out redundant fields from variable
            const { path: p2, accountId: a2, containerId: c2, workspaceId: w2, fingerprint: f2, tagManagerUrl: t2, ...variableData } = response.data;
            return {
              content: [
                { type: "text", text: JSON.stringify(variableData, null, 2) },
              ],
            };

          default:
            throw new Error(`Invalid entity type: ${entity_type}`);
        }
      } catch (error) {
        return createErrorResponse(
          `Error getting ${entity_type} ${entity_id} in workspace ${workspace_id}`,
          error,
        );
      }
    },
  );
}; 