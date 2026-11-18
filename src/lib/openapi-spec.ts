export function getOpenApiSpec(baseUrl = "http://localhost:3000") {
  return {
    openapi: "3.0.3",
    info: {
      title: "King Legacy Global Event Tracker API",
      version: "1.0.0",
      description:
        "Full-Stack Real-Time Event Tracking, Roblox Public Server Discovery, World/Sea Classification, and Multi-Provider Event Detection API for Roblox King Legacy (Universe 1451439645).",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
        CookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "kl_session",
        },
      },
    },
    paths: {
      "/api/v1/health": {
        get: {
          tags: ["System"],
          summary: "Check API, Database, Redis/Queue, and Scanner health",
          responses: { "200": { description: "Healthy status JSON" } },
        },
      },
      "/api/v1/categories": {
        get: {
          tags: ["Events"],
          summary: "List all King Legacy event categories with active detection counts",
          responses: { "200": { description: "Category list" } },
        },
      },
      "/api/v1/events": {
        get: {
          tags: ["Events"],
          summary: "List all catalogued King Legacy events",
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "world", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "q", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Paginated events list" } },
        },
        post: {
          tags: ["Events"],
          summary: "Create a new King Legacy event (Admin only)",
          security: [{ CookieAuth: [] }, { ApiKeyAuth: [] }],
          responses: { "201": { description: "Event created" }, "403": { description: "Admin required" } },
        },
      },
      "/api/v1/events/{id}": {
        get: {
          tags: ["Events"],
          summary: "Get detailed event information and recent detections",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Event details" }, "404": { description: "Not found" } },
        },
        put: {
          tags: ["Events"],
          summary: "Update an event (Admin only)",
          security: [{ CookieAuth: [] }, { ApiKeyAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Events"],
          summary: "Delete an event (Admin only)",
          security: [{ CookieAuth: [] }, { ApiKeyAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/v1/events/active": {
        get: { tags: ["Events"], summary: "List events currently marked ACTIVE", responses: { "200": { description: "Active events" } } },
      },
      "/api/v1/events/upcoming": {
        get: { tags: ["Events"], summary: "List UPCOMING events", responses: { "200": { description: "Upcoming events" } } },
      },
      "/api/v1/events/history": {
        get: { tags: ["Events"], summary: "Query historical event detection archive", responses: { "200": { description: "Event history" } } },
      },
      "/api/v1/events/global": {
        get: {
          tags: ["Global Detections"],
          summary: "List global event detections across all discovered servers",
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "world", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "verification", in: "query", schema: { type: "string" } },
            { name: "sort", in: "query", schema: { type: "string", enum: ["ending_soonest", "just_found", "most_recent", "most_active"] } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "serverId", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Global detections list" } },
        },
      },
      "/api/v1/events/global/active": {
        get: { tags: ["Global Detections"], summary: "List only ACTIVE/UPCOMING detections across all servers", responses: { "200": { description: "Active global detections" } } },
      },
      "/api/v1/events/report": {
        post: {
          tags: ["Community & Agents"],
          summary: "Submit a community event report tied to a Roblox Server Job ID and Place ID",
          responses: { "201": { description: "Report accepted" } },
        },
      },
      "/api/v1/servers": {
        get: {
          tags: ["Servers"],
          summary: "List discovered King Legacy public servers with World/Sea & scan status",
          responses: { "200": { description: "Servers list" } },
        },
      },
      "/api/v1/servers/{id}": {
        get: {
          tags: ["Servers"],
          summary: "Get server details by ID or Roblox Job ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Server details" } },
        },
      },
      "/api/v1/servers/{id}/events": {
        get: {
          tags: ["Servers"],
          summary: "Get all event detections bound to a specific server",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Server events" } },
        },
      },
      "/api/v1/servers/world/{world}": {
        get: {
          tags: ["Servers"],
          summary: "List servers filtered by World/Sea (FIRST_SEA, SECOND_SEA, THIRD_SEA)",
          parameters: [{ name: "world", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "World servers" } },
        },
      },
      "/api/v1/scanner/status": {
        get: { tags: ["Scanner"], summary: "Get scanner worker status and active detection sources", responses: { "200": { description: "Scanner status" } } },
      },
      "/api/v1/scanner/statistics": {
        get: { tags: ["Scanner"], summary: "Get discovery & event statistics per World/Sea", responses: { "200": { description: "Scanner statistics" } } },
      },
      "/api/v1/scanner/history": {
        get: { tags: ["Scanner"], summary: "Get recent background scanner job runs and server scan logs", responses: { "200": { description: "Scanner job history" } } },
      },
      "/api/v1/scanner/coverage": {
        get: { tags: ["Scanner"], summary: "Get transparent scanner coverage metrics (discovered vs scanned vs verified)", responses: { "200": { description: "Coverage report" } } },
      },
      "/api/v1/scanner/trigger": {
        post: { tags: ["Scanner"], summary: "Trigger an immediate Roblox Public Server Discovery & Provider sweep", responses: { "200": { description: "Scan finished" } } },
      },
      "/api/v1/scanner/agent-ingest": {
        post: { tags: ["Community & Agents"], summary: "Ingest verified telemetry from an Authorized Monitoring Agent", responses: { "201": { description: "Verified detection ingested" } } },
      },
      "/api/v1/stream/global": {
        get: { tags: ["Real-Time"], summary: "Server-Sent Events (SSE) stream for live event, server, and notification updates", responses: { "200": { description: "text/event-stream" } } },
      },
    },
  };
}
