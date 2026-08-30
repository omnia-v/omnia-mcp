export { OmniaClient, DEFAULT_BASE_URL } from "./client.js";
/** The client under the product's name; `OmniaClient` stays exported for existing code. */
export { OmniaClient as ErrorbarClient } from "./client.js";
export type { ClientOptions, ApiResponse } from "./client.js";
export { createServer, selectOperations, selectComposites, inputShapeFor, descriptionFor } from "./server.js";
export type { ServerOptions } from "./server.js";
export { PROFILES, PROFILE_NAMES, COMPOSITE_TOOLS, resolveProfile } from "./profiles.js";
export type { Profile, CompositeTool } from "./profiles.js";
export { AFTER_TRAFFIC_FLOWS } from "./extras.js";
export { OPERATIONS } from "./manifest.js";
export type { Operation, Param, Scope } from "./manifest-types.js";
