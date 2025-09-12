import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import { list_accounts } from "./list_accounts";
import { list_containers } from "./list_containers";
import { list_workspaces } from "./list_workspaces";
import { create_workspace } from "./create_workspace";
import { sync_workspace } from "./sync_workspace";
import { list_workspace_entities } from "./list_workspace_entities";
import { get_workspace_entity } from "./get_workspace_entity";
import { publish_workspace } from "./publish_workspace";
import { create_update_delete_tag } from "./create_update_delete_tag";
import { create_update_delete_trigger } from "./create_update_delete_trigger";
import { create_update_delete_variable } from "./create_update_delete_variable";
import { remove_mcp_server_data } from "./remove_mcp_server_data";

export const tools_v2 = [create_update_delete_tag, create_update_delete_trigger];

export const registerTools = (
  server: McpServer,
  params: McpAgentToolParamsModel,
): void => {
  list_accounts(server, params);
  list_containers(server, params);
  list_workspaces(server, params);
  create_workspace(server, params);
  sync_workspace(server, params);
  list_workspace_entities(server, params);
  get_workspace_entity(server, params);
  publish_workspace(server, params);
  create_update_delete_tag(server, params);
  create_update_delete_trigger(server, params);
  create_update_delete_variable(server, params);
  remove_mcp_server_data(server, params);
  
}; 
