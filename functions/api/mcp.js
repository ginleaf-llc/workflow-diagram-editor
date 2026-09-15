const SERVER_INFO = {
  name: "workflow-diagram-editor",
  version: "0.1.0",
};

const VIEWS = ["workflow", "data", "ui"];

const TOOLS = [
  {
    name: "read_diagram",
    description: "指定したアプリと画面の図データを読み取ります。",
    inputSchema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "アプリケーションの識別子",
        },
        view: {
          type: "string",
          enum: VIEWS,
          description: "画面の種類",
        },
      },
      required: ["app", "view"],
      additionalProperties: false,
    },
  },
  {
    name: "write_diagram",
    description: "指定したアプリと画面の図データを保存します。",
    inputSchema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "アプリケーションの識別子",
        },
        view: {
          type: "string",
          description: "画面の識別子",
        },
        nodes: {
          type: "array",
          description: "保存する図のノード配列",
        },
      },
      required: ["app", "view", "nodes"],
      additionalProperties: false,
    },
  },
];

class JsonRpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let message;
  try {
    message = await request.json();
  } catch {
    return jsonResponse(jsonRpcError(null, -32700, "Parse error"), 400);
  }

  if (!isJsonRpcRequest(message)) {
    return jsonResponse(jsonRpcError(null, -32600, "Invalid Request"), 400);
  }

  const id = Object.prototype.hasOwnProperty.call(message, "id")
    ? message.id
    : null;

  try {
    const result = await dispatch(message.method, message.params, env);

    // JSON-RPC notifications do not receive a response body.
    if (!Object.prototype.hasOwnProperty.call(message, "id")) {
      return new Response(null, { status: 202 });
    }

    return jsonResponse({ jsonrpc: "2.0", id, result });
  } catch (error) {
    if (!Object.prototype.hasOwnProperty.call(message, "id")) {
      return new Response(null, { status: 202 });
    }

    if (error instanceof JsonRpcError) {
      return jsonResponse(jsonRpcError(id, error.code, error.message), 200);
    }

    return jsonResponse(jsonRpcError(id, -32603, "Internal error"), 500);
  }
}

function isAuthorized(request, env) {
  const accessToken = env?.MCP_ACCESS_TOKEN;
  const authorization = request.headers.get("Authorization");

  return (
    typeof accessToken === "string" &&
    accessToken.length > 0 &&
    authorization === `Bearer ${accessToken}`
  );
}

function isJsonRpcRequest(message) {
  return (
    message !== null &&
    typeof message === "object" &&
    !Array.isArray(message) &&
    message.jsonrpc === "2.0" &&
    typeof message.method === "string"
  );
}

async function dispatch(method, params, env) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {},
        },
        serverInfo: SERVER_INFO,
      };
    case "notifications/initialized":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      return callTool(params, env);
    default:
      throw new JsonRpcError(-32601, "Method not found");
  }
}

async function callTool(params, env) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new JsonRpcError(-32602, "Invalid params");
  }

  const { name, arguments: toolArguments = {} } = params;

  if (name === "read_diagram") {
    return readDiagram(toolArguments, env);
  }

  if (name === "write_diagram") {
    return writeDiagram(toolArguments, env);
  }

  throw new JsonRpcError(-32602, "Unknown tool");
}

async function readDiagram(toolArguments, env) {
  const { app, view } = validateReadArguments(toolArguments);
  const nodes = await getStoredNodes(env, diagramKey(app, view));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(nodes),
      },
    ],
  };
}

const MAX_NODES = 500;
const MAX_PAYLOAD_BYTES = 200_000;

async function writeDiagram(toolArguments, env) {
  const { app, view, nodes } = validateWriteArguments(toolArguments);
  const key = diagramKey(app, view);

  if (nodes.length > MAX_NODES) {
    throw new JsonRpcError(-32602, `nodes exceeds the limit of ${MAX_NODES}`);
  }
  const serialized = JSON.stringify(nodes);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    throw new JsonRpcError(-32602, `payload exceeds the limit of ${MAX_PAYLOAD_BYTES} bytes`);
  }

  ensureKvBinding(env);
  await env.WORKFLOW_KV.put(key, serialized);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          app,
          view,
          saved: true,
          nodeCount: nodes.length,
        }),
      },
    ],
  };
}

function validateReadArguments(toolArguments) {
  if (!toolArguments || typeof toolArguments !== "object" || Array.isArray(toolArguments)) {
    throw new JsonRpcError(-32602, "Invalid params");
  }

  const { app, view } = toolArguments;
  if (typeof app !== "string" || app.length === 0 || !VIEWS.includes(view)) {
    throw new JsonRpcError(-32602, "read_diagram requires app and a valid view");
  }

  return { app, view };
}

function validateWriteArguments(toolArguments) {
  if (!toolArguments || typeof toolArguments !== "object" || Array.isArray(toolArguments)) {
    throw new JsonRpcError(-32602, "Invalid params");
  }

  const { app, view, nodes } = toolArguments;
  if (
    typeof app !== "string" ||
    app.length === 0 ||
    typeof view !== "string" ||
    view.length === 0 ||
    !Array.isArray(nodes)
  ) {
    throw new JsonRpcError(-32602, "write_diagram requires app, view, and nodes");
  }

  return { app, view, nodes };
}

async function getStoredNodes(env, key) {
  ensureKvBinding(env);
  const stored = await env.WORKFLOW_KV.get(key);

  if (stored === null) {
    return [];
  }

  let nodes;
  try {
    nodes = JSON.parse(stored);
  } catch {
    throw new Error("Stored diagram data is not valid JSON");
  }

  if (!Array.isArray(nodes)) {
    throw new Error("Stored diagram data is not a node array");
  }

  return nodes;
}

function ensureKvBinding(env) {
  if (!env?.WORKFLOW_KV || typeof env.WORKFLOW_KV.get !== "function" || typeof env.WORKFLOW_KV.put !== "function") {
    throw new Error("WORKFLOW_KV binding is not configured");
  }
}

function diagramKey(app, view) {
  return `diagram:${app}:${view}`;
}

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
