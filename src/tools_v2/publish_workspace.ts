import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";

export const publish_workspace = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "publish_workspace",
    "Creates a container version from a workspace and publishes it",
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
      version_name: z
        .string()
        .describe("Name of the version to be created."),
      version_description: z
        .string()
        .optional()
        .describe("Description of the version to be created."),
    },
    async ({ account_id, container_id, workspace_id, version_name, version_description }): Promise<CallToolResult> => {
      log(
        `Running tool: publish_workspace for workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);

        // Step 1: Create a container version from the workspace
        log("Creating container version from workspace...");
        const createResponse = await tagmanager.accounts.containers.workspaces.create_version({
          path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`,
          requestBody: {
            name: version_name,
            notes: version_description,
          },
        });

        // Extract the containerVersionId from the response
        const containerVersionId = createResponse?.data?.containerVersion?.containerVersionId;

        if (!containerVersionId) {
          throw new Error("No containerVersionId returned from create_version");
        }

        // Step 2: Publish the container version
        log(`Publishing container version ${containerVersionId}...`);
        const publishResponse = await tagmanager.accounts.containers.versions.publish({
          path: `accounts/${account_id}/containers/${container_id}/versions/${containerVersionId}`,
        });

        // Return only the essential information
        const result = {
          containerVersionId,
          name: publishResponse?.data?.containerVersion?.name,
          description: publishResponse?.data?.containerVersion?.description,
          publishTime: publishResponse?.data?.containerVersion?.fingerprint // Using fingerprint as publish time since it's updated on publish
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error publishing workspace ${workspace_id}`,
          error,
        );
      }
    },
  );
}; 