import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { tagmanager_v2 } from "googleapis";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import Schema$Trigger = tagmanager_v2.Schema$Trigger;
import { ConditionSchema } from "../schemas/ConditionSchema";

// Reuse the existing trigger schema components
const TriggerParameterSchema = z.object({
  type: z.string().optional().describe("The type of the parameter."),
  key: z.string().optional().describe("Parameter key."),
  value: z.string().optional().describe("Parameter value."),
  list: z.array(z.any()).optional().describe("List of parameter values."),
  map: z.array(z.any()).optional().describe("Array of key-value pairs."),
});

export const manage_trigger = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "manage_trigger",
    "Create, update, or delete a GTM Trigger",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The action to perform on the trigger."),
      account_id: z
        .string()
        .describe("The unique ID of the GTM Account."),
      container_id: z
        .string()
        .describe("The unique ID of the GTM Container."),
      workspace_id: z
        .string()
        .describe("The unique ID of the GTM Workspace."),
      trigger_id: z
        .string()
        .optional()
        .describe("Required for update/delete. The unique ID of the GTM Trigger."),
      name: z
        .string()
        .optional()
        .describe("Required for create/update. Trigger display name."),
      type: z
        .string()
        .optional()
        .describe("Required for create/update. Defines the data layer event that causes this trigger."),
      custom_event_filter: z
        .array(z.any())
        .optional()
        .describe("Used in the case of custom event, which is fired iff all Conditions are true."),
      filter: z
        .array(z.any())
        .optional()
        .describe("The trigger will only fire iff all Conditions are true."),
      auto_event_filter: z
        .array(z.any())
        .optional()
        .describe("Used in the case of auto event tracking."),
      parameter: z
        .array(TriggerParameterSchema)
        .optional()
        .describe("The trigger's parameters."),
      fingerprint: z
        .string()
        .optional()
        .describe("Required for update. The fingerprint of the GTM Trigger for concurrency control."),
      notes: z
        .string()
        .optional()
        .describe("User notes on how to apply this trigger in the container."),
      parent_folder_id: z
        .string()
        .optional()
        .describe("Parent folder id."),
    },
    async ({
      action,
      account_id,
      container_id,
      workspace_id,
      trigger_id,
      fingerprint,
      name,
      type,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: manage_trigger with action ${action} for workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);

        // Validate required fields
        if (action !== "delete" && (!name || !type)) {
          throw new Error("Name and type are required for creating and updating a trigger");
        }

        // For update and delete operations, try to get the existing trigger first
        let existingTrigger: Schema$Trigger | undefined;
        if (action !== "create" && trigger_id) {
          try {
            const getResponse = await tagmanager.accounts.containers.workspaces.triggers.get({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/triggers/${trigger_id}`,
            });
            existingTrigger = getResponse.data;
          } catch (error: any) {
            // If the error is due to workspace being submitted, create a new workspace
            if (error.message?.includes("Workspace is already submitted")) {
              // Create new workspace
              const createResponse = await tagmanager.accounts.containers.workspaces.create({
                parent: `accounts/${account_id}/containers/${container_id}`,
                requestBody: {
                  name: `MCP Update Trigger ${trigger_id}`,
                  description: `Workspace for updating trigger ${trigger_id} via MCP`,
                },
              });
              workspace_id = createResponse.data.workspaceId!;
              log(`Created new workspace ${workspace_id} for trigger update`);

              // Get the trigger from the new workspace
              const getResponse = await tagmanager.accounts.containers.workspaces.triggers.get({
                path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/triggers/${trigger_id}`,
              });
              existingTrigger = getResponse.data;
            } else {
              throw error;
            }
          }
        }

        // Convert snake_case parameters to camelCase for the API
        const requestBody: Schema$Trigger = action === "delete" ? {} : {
          name,
          type,
          notes: rest.notes,
          parameter: rest.parameter?.length ? rest.parameter : existingTrigger?.parameter,
          customEventFilter: rest.custom_event_filter?.length ? rest.custom_event_filter : existingTrigger?.customEventFilter,
          filter: rest.filter?.length ? rest.filter : existingTrigger?.filter,
          autoEventFilter: rest.auto_event_filter?.length ? rest.auto_event_filter : existingTrigger?.autoEventFilter,
          parentFolderId: rest.parent_folder_id || existingTrigger?.parentFolderId,
        };

        let response;

        switch (action) {
          case "create":
            response = await tagmanager.accounts.containers.workspaces.triggers.create({
              parent: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`,
              requestBody,
            });
            break;

          case "update":
            if (!trigger_id) {
              throw new Error("Trigger ID is required for updating a trigger");
            }
            response = await tagmanager.accounts.containers.workspaces.triggers.update({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/triggers/${trigger_id}`,
              fingerprint: existingTrigger?.fingerprint || fingerprint,
              requestBody,
            });
            break;

          case "delete":
            if (!trigger_id) {
              throw new Error("Trigger ID is required for deleting a trigger");
            }
            await tagmanager.accounts.containers.workspaces.triggers.delete({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/triggers/${trigger_id}`,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Trigger ${trigger_id} was successfully deleted`,
                      workspaceId: workspace_id,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
        }

        // For create and update, return minimal response [[memory:2837403]]
        if (response?.data) {
          const result = {
            triggerId: response.data.triggerId,
            name: response.data.name,
            type: response.data.type,
            workspaceId: workspace_id,
          };

          return {
            content: [
              { type: "text", text: JSON.stringify(result, null, 2) },
            ],
          };
        }

        throw new Error("No response data received from the API");
      } catch (error) {
        return createErrorResponse(
          `Error performing ${action} operation on trigger${trigger_id ? ` ${trigger_id}` : ""} in workspace ${workspace_id}`,
          error,
        );
      }
    },
  );
}; 