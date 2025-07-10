import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { tagmanager_v2 } from "googleapis";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import Schema$Tag = tagmanager_v2.Schema$Tag;
import Schema$Parameter = tagmanager_v2.Schema$Parameter;
import Schema$TagConsentSetting = tagmanager_v2.Schema$TagConsentSetting;

// Reuse the existing tag schema components
const ConsentSettingSchema = z.object({
  consent_status: z
    .enum(["notSet", "notNeeded", "needed"])
    .optional()
    .describe(
      "The tag's consent status. If set to NEEDED, the runtime will check that the consent types specified by the consentType field have been granted.",
    ),
  consent_type: z.array(z.any()).optional().describe(
    "The type of consents to check for during tag firing if in the consent NEEDED state.",
  ),
});

const SetupTagSchema = z.object({
  tag_name: z.string().optional().describe("The name of the setup tag."),
  stop_on_setup_failure: z
    .boolean()
    .optional()
    .describe(
      "If true, fire the main tag if and only if the setup tag fires successfully. If false, fire the main tag regardless of setup tag firing status.",
    ),
});

const TeardownTagSchema = z.object({
  tag_name: z.string().optional().describe("The name of the teardown tag."),
  stop_teardown_on_failure: z
    .boolean()
    .optional()
    .describe(
      "If true, fire the teardown tag if and only if the main tag fires successfully. If false, fire the teardown tag regardless of main tag firing status.",
    ),
});

export const manage_tag = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "manage_tag",
    "Create, update, or delete a GTM Tag",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The action to perform on the tag."),
      account_id: z
        .string()
        .describe("The unique ID of the GTM Account."),
      container_id: z
        .string()
        .describe("The unique ID of the GTM Container."),
      workspace_id: z
        .string()
        .describe("The unique ID of the GTM Workspace."),
      tag_id: z
        .string()
        .optional()
        .describe("Required for update/delete. The unique ID of the GTM Tag."),
      name: z
        .string()
        .optional()
        .describe("Required for create/update. Tag display name."),
      type: z
        .string()
        .optional()
        .describe("Required for create/update. GTM Tag Type."),
      live_only: z
        .boolean()
        .optional()
        .describe(
          "If set to true, this tag will only fire in the live environment.",
        ),
      priority: z
        .number()
        .optional()
        .describe(
          "User defined numeric priority of the tag. Default is 0.",
        ),
      notes: z
        .string()
        .optional()
        .describe("User notes on how to apply this tag in the container."),
      schedule_start_ms: z
        .string()
        .optional()
        .describe("The start timestamp in milliseconds to schedule a tag."),
      schedule_end_ms: z
        .string()
        .optional()
        .describe("The end timestamp in milliseconds to schedule a tag."),
      parameter: z
        .array(z.any())
        .optional()
        .describe("The tag's parameters."),
      firing_trigger_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Firing trigger IDs. A tag will fire when any of the listed triggers are true.",
        ),
      blocking_trigger_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Blocking trigger IDs. If any of the listed triggers evaluate to true, the tag will not fire.",
        ),
      setup_tags: z
        .array(SetupTagSchema)
        .optional()
        .describe("The list of setup tags. Currently only one is allowed."),
      teardown_tags: z
        .array(TeardownTagSchema)
        .optional()
        .describe("The list of teardown tags. Currently only one is allowed."),
      tag_firing_option: z
        .enum([
          "tagFiringOptionUnspecified",
          "unlimited",
          "oncePerEvent",
          "oncePerLoad",
        ])
        .optional()
        .describe("Option to fire this tag."),
      paused: z
        .boolean()
        .optional()
        .describe(
          "Indicates whether the tag is paused, which prevents the tag from firing.",
        ),
      consent_settings: ConsentSettingSchema.optional().describe(
        "Consent settings of a tag.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "Required for update. The fingerprint of the GTM Tag for concurrency control.",
        ),
    },
    async ({
      action,
      account_id,
      container_id,
      workspace_id,
      tag_id,
      fingerprint,
      name,
      type,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: manage_tag with action ${action} for workspace ${workspace_id}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);

        // Validate required fields
        if (action !== "delete" && (!name || !type)) {
          throw new Error("Name and type are required for creating and updating a tag");
        }

        // For update and delete operations, try to get the existing tag first
        let existingTag: Schema$Tag | undefined;
        if (action !== "create" && tag_id) {
          try {
            const getResponse = await tagmanager.accounts.containers.workspaces.tags.get({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/tags/${tag_id}`,
            });
            existingTag = getResponse.data;
          } catch (error: any) {
            // If the error is due to workspace being submitted, create a new workspace
            if (error.message?.includes("Workspace is already submitted")) {
              // Create new workspace
              const createResponse = await tagmanager.accounts.containers.workspaces.create({
                parent: `accounts/${account_id}/containers/${container_id}`,
                requestBody: {
                  name: `MCP Update Tag ${tag_id}`,
                  description: `Workspace for updating tag ${tag_id} via MCP`,
                },
              });
              workspace_id = createResponse.data.workspaceId!;
              log(`Created new workspace ${workspace_id} for tag update`);

              // Get the tag from the new workspace
              const getResponse = await tagmanager.accounts.containers.workspaces.tags.get({
                path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/tags/${tag_id}`,
              });
              existingTag = getResponse.data;
            } else {
              throw error;
            }
          }
        }

        // Convert snake_case parameters to camelCase for the API
        const requestBody: Schema$Tag = action === "delete" ? {} : {
          name,
          type,
          liveOnly: rest.live_only,
          priority: rest.priority ? {
            type: "template",
            value: rest.priority.toString(),
          } as Schema$Parameter : undefined,
          notes: rest.notes,
          scheduleStartMs: rest.schedule_start_ms,
          scheduleEndMs: rest.schedule_end_ms,
          parameter: rest.parameter?.length ? rest.parameter as Schema$Parameter[] : existingTag?.parameter,
          firingTriggerId: rest.firing_trigger_ids?.length ? rest.firing_trigger_ids : existingTag?.firingTriggerId,
          blockingTriggerId: rest.blocking_trigger_ids?.length ? rest.blocking_trigger_ids : existingTag?.blockingTriggerId,
          setupTag: rest.setup_tags?.map(st => ({
            tagName: st.tag_name,
            stopOnSetupFailure: st.stop_on_setup_failure,
          })),
          teardownTag: rest.teardown_tags?.map(tt => ({
            tagName: tt.tag_name,
            stopTeardownOnFailure: tt.stop_teardown_on_failure,
          })),
          tagFiringOption: rest.tag_firing_option || existingTag?.tagFiringOption,
          paused: rest.paused,
          consentSettings: rest.consent_settings ? {
            consentStatus: rest.consent_settings.consent_status,
            consentType: rest.consent_settings.consent_type ? {
              type: "template",
              value: JSON.stringify(rest.consent_settings.consent_type),
            } as Schema$Parameter : undefined,
          } : existingTag?.consentSettings,
        };

        // For HTML tags, ensure the html parameter is preserved if not explicitly provided
        if (type === "html" && (!requestBody.parameter || !requestBody.parameter.some(p => p.key === "html"))) {
          const htmlParam = existingTag?.parameter?.find(p => p.key === "html");
          if (htmlParam) {
            requestBody.parameter = requestBody.parameter || [];
            requestBody.parameter.push(htmlParam);
          } else {
            throw new Error("HTML parameter is required for HTML tags");
          }
        }

        let response;

        switch (action) {
          case "create":
            response = await tagmanager.accounts.containers.workspaces.tags.create({
              parent: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}`,
              requestBody,
            });
            break;

          case "update":
            if (!tag_id) {
              throw new Error("Tag ID is required for updating a tag");
            }
            response = await tagmanager.accounts.containers.workspaces.tags.update({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/tags/${tag_id}`,
              fingerprint: existingTag?.fingerprint || fingerprint,
              requestBody,
            });
            break;

          case "delete":
            if (!tag_id) {
              throw new Error("Tag ID is required for deleting a tag");
            }
            await tagmanager.accounts.containers.workspaces.tags.delete({
              path: `accounts/${account_id}/containers/${container_id}/workspaces/${workspace_id}/tags/${tag_id}`,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Tag ${tag_id} was successfully deleted`,
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
            tagId: response.data.tagId,
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
          `Error performing ${action} operation on tag${tag_id ? ` ${tag_id}` : ""} in workspace ${workspace_id}`,
          error,
        );
      }
    },
  );
}; 