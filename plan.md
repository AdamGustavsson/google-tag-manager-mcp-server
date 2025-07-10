# Plan to Refactor Google Tag Manager MCP Server Tools

This document outlines the plan to refactor the existing codebase to align with the new, consolidated tool specifications. The goal is to create a more intuitive and streamlined interface by wrapping and composing existing tool logic rather than rewriting it from scratch.

## Phase 1: Project Restructuring

To maintain a clean separation between the old and new tool definitions, we will introduce a new directory structure.

1.  **Create New Tools Directory**:
    - Create a new directory `src/tools_v2` to house the refactored tool files. This isolates the new implementation and prevents conflicts with the existing toolset.

2.  **Update Main Tool Index**:
    - Modify `src/tools/index.ts` to import and export the tools from the new `src/tools_v2` directory. This will be the final step after all new tools are implemented.

## Phase 2: Direct Tool Mapping and Refactoring

For tools that have a one-to-one correspondence with existing tools, we will create simple wrappers to adapt their names, descriptions, and input schemas.

- **`list_accounts`**:
  - Create `src/tools_v2/list_accounts.ts`.
  - This tool will wrap the existing `tag_manager_list_accounts` logic from `src/tools/accounts/list.ts`.
  - The implementation will simply call the original function, as no input schema change is needed.

- **`list_containers`**:
  - Create `src/tools_v2/list_containers.ts`.
  - Wrap `tag_manager_list_containers` from `src/tools/containers/list.ts`.
  - Adapt the input schema to use `account_id` and map it to `accountId` for the underlying function.

- **`list_workspaces`**:
  - Create `src/tools_v2/list_workspaces.ts`.
  - Wrap `tag_manager_list_container_workspaces` from `src/tools/workspaces/list.ts`.
  - Adapt the input schema to use `account_id` and `container_id`.

- **`create_workspace`**:
  - Create `src/tools_v2/create_workspace.ts`.
  - Wrap `tag_manager_create_container_workspace` from `src/tools/workspaces/create.ts`.
  - Map the new input fields (`account_id`, `container_id`, `name`, `description`) to the existing `WorkspaceSchemaFields`.

- **`sync_workspace`**:
  - Create `src/tools_v2/sync_workspace.ts`.
  - Wrap `tag_manager_sync_container_workspace` from `src/tools/workspaces/sync.ts`.
  - Adapt the input schema to use `snake_case` and map to the existing function's `camelCase` parameters.

## Phase 3: Composite Tool Implementation

This phase involves creating new tools that orchestrate calls to multiple existing tool functions to provide a more powerful and abstract interface.

- **`list_workspace_entities`**:
  - Create `src/tools_v2/list_workspace_entities.ts`.
  - This tool will concurrently call `tag_manager_list_tags`, `tag_manager_list_triggers`, and `tag_manager_list_variables`.
  - It will use `Promise.all` to fetch all entities in parallel.
  - The results will be aggregated into a single JSON object with `tags`, `triggers`, and `variables` keys, as specified in the new tool description.

- **`get_workspace_entity`**:
  - Create `src/tools_v2/get_workspace_entity.ts`.
  - The tool will accept an `entity_type` parameter (`tag`, `trigger`, or `variable`).
  - A `switch` statement will be used to call the corresponding `get` function:
    - `tag`: `tag_manager_get_tag`
    - `trigger`: `tag_manager_get_trigger`
    - `variable`: `tag_manager_get_variable`
  - The tool will format the response to include details about related entities (e.g., triggers for a tag).

- **`publish_workspace`**:
  - Create `src/tools_v2/publish_workspace.ts`.
  - This tool will perform a two-step process:
    1.  Call `tag_manager_create_container_version_from_workspace` using the provided `workspace_id`, `version_name`, and `version_description`.
    2.  Extract the `containerVersionId` from the response of the first step.
    3.  Call `tag_manager_publish_container_version` with the new `containerVersionId` to make the changes live.

## Phase 4: Management Tool Implementation

This phase will focus on creating the "manage" tools, which act as versatile wrappers for CRUD (Create, Read, Update, Delete) operations on GTM entities.

- **`manage_tag`**:
  - Create `src/tools_v2/manage_tag.ts`.
  - The tool will use a `switch` statement on the `action` parameter (`create`, `update`, `delete`).
  - Each case will call the corresponding existing tool: `tag_manager_create_tag`, `tag_manager_update_tag`, or `tag_manager_delete_tag`.
  - Input fields will be mapped from `snake_case` to `camelCase`.

- **`manage_trigger`**:
  - Create `src/tools_v2/manage_trigger.ts`.
  - Similar to `manage_tag`, this will wrap the create, update, and delete functions for triggers.
  - It will handle the mapping of the `custom_event_filter` to the `ConditionSchema`.

- **`manage_variable`**:
  - Create `src/tools_v2/manage_variable.ts`.
  - This will wrap the create, update, and delete functions for variables.
  - It will also handle the mapping for `format_value_case_conversion_type`.

## Phase 5: Finalization and Cleanup

1.  **Update Tool Index**:
    - Once all new tools are implemented and tested, the `src/tools/index.ts` file will be updated to export the array of new tools from `src/tools_v2`.

2.  **Code Review**:
    - Conduct a final review of the new tool implementations to ensure consistency, correctness, and adherence to the plan.

3.  **Documentation**:
    - Although not part of the code, internal documentation should be updated to reflect the new, simplified toolset and deprecate the old tools for future development.