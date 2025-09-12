import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { tagmanager_v2 } from "googleapis";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import Schema$Variable = tagmanager_v2.Schema$Variable;
import { FormatValueSchema } from "../schemas/VariableSchema";

// Reuse the existing parameter schema components
const VariableParameterSchema = z.object({
  type: z.string().optional().describe("The type of the parameter."),
  key: z.string().optional().describe("Parameter key."),
  value: z.string().optional().describe("Parameter value."),
  list: z.array(z.any()).optional().describe("List of parameter values."),
  map: z.array(z.any()).optional().describe("Array of key-value pairs."),
});

export const create_update_delete_variable = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "create_update_delete_variable",
    "Create, update, or delete a GTM Variable",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The action to perform on the variable."),
      account_id: z
        .string()
        .describe("The unique ID of the GTM Account."),
      container_id: z
        .string()
        .describe("The unique ID of the GTM Container."),
      workspace_id: z
        .string()
        .describe("The unique ID of the GTM Workspace."),
      variable_id: z
        .string()
        .optional()
        .describe("Required for update/delete. The unique ID of the GTM Variable."),
      name: z
        .string()
        .optional()
        .describe("Required for create/update. Variable display name."),
      type: z
        .string()
        .optional()
        .describe("Required for create/update. GTM Variable Type."),
      parameter: z
        .array(VariableParameterSchema)
        .optional()
        .describe("The variable's parameters."),
      notes: z
        .string()
        .optional()
        .describe("User notes on how to apply this variable in the container."),
      schedule_start_ms: z
        .string()
        .optional()
        .describe("The start timestamp in milliseconds to schedule a variable."),
      schedule_end_ms: z
        .string()
        .optional()
        .describe("The end timestamp in milliseconds to schedule a variable."),
      enabling_trigger_id: z
        .array(z.string())
        .optional()
        .describe("For mobile containers only: A list of trigger IDs for enabling conditional variables."),
      disabling_trigger_id: z
        .array(z.string())
        .optional()
        .describe("For mobile containers only: A list of trigger IDs for disabling conditional variables."),
      parent_folder_id: z
        .string()
        .optional()
        .describe("Parent folder id."),
      format_value: FormatValueSchema
        .optional()
        .describe("Option to convert a variable value to other value."),
    },
    async ({
      action,
      account_id,
      container_id,
      workspace_id,
      variable_id,
      name,
      type,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: create_update_delete_variable with action ${action} for workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);

        // Validate required fields
        if (action !== "delete" && (!name || !type)) {
          throw new Error("Name and type are required for creating and updating a variable");
        }

        // For update and delete operations, try to get the existing variable first
        let existingVariable: Schema$Variable | undefined;
        if (action !== "create" && variable_id) {
          try {
            const getResponse = await tagmanager.accounts.containers.workspaces.variables.get({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/variables/${variable_id}`,
            });
            existingVariable = getResponse.data;
          } catch (error: any) {
            // If the error is due to workspace being submitted, create a new workspace
            if (error.message?.includes("Workspace is already submitted")) {
              // Create new workspace
              const createResponse = await tagmanager.accounts.containers.workspaces.create({
                parent: `accounts/${account_id}/containers/${container_id}`,
                requestBody: {
                  name: `MCP Update Variable ${variable_id}`,
                  description: `Workspace for updating variable ${variable_id} via MCP`,
                },
              });
              workspace_id = createResponse.data.workspaceId!;
              log(`Created new workspace ${workspace_id} for variable update`);

              // Get the variable from the new workspace
              const getResponse = await tagmanager.accounts.containers.workspaces.variables.get({
                path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/variables/${variable_id}`,
              });
              existingVariable = getResponse.data;
            } else {
              throw error;
            }
          }
        }

        // Convert snake_case parameters to camelCase for the API
        const requestBody: Schema$Variable = action === "delete" ? {} : {
          name,
          type,
          notes: rest.notes,
          parameter: rest.parameter?.length ? rest.parameter : existingVariable?.parameter,
          scheduleStartMs: rest.schedule_start_ms || existingVariable?.scheduleStartMs,
          scheduleEndMs: rest.schedule_end_ms || existingVariable?.scheduleEndMs,
          enablingTriggerId: rest.enabling_trigger_id?.length ? rest.enabling_trigger_id : existingVariable?.enablingTriggerId,
          disablingTriggerId: rest.disabling_trigger_id?.length ? rest.disabling_trigger_id : existingVariable?.disablingTriggerId,
          parentFolderId: rest.parent_folder_id || existingVariable?.parentFolderId,
          formatValue: rest.format_value || existingVariable?.formatValue,
        };

        let response;

        switch (action) {
          case "create":
            response = await tagmanager.accounts.containers.workspaces.variables.create({
              parent: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`,
              requestBody,
            });
            break;

          case "update":
            if (!variable_id) {
              throw new Error("Variable ID is required for updating a variable");
            }
            response = await tagmanager.accounts.containers.workspaces.variables.update({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/variables/${variable_id}`,
              fingerprint: (existingVariable?.fingerprint || undefined) as string | undefined,
              requestBody,
            });
            break;

          case "delete":
            if (!variable_id) {
              throw new Error("Variable ID is required for deleting a variable");
            }
            await tagmanager.accounts.containers.workspaces.variables.delete({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/variables/${variable_id}`,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Variable ${variable_id} was successfully deleted`,
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
            variableId: response.data.variableId,
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
          `Error performing ${action} operation on variable${variable_id ? ` ${variable_id}` : ""} in workspace ${workspace_id}`,
          error,
        );
      }
    },
  );
}; 
