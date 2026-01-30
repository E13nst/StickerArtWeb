/**
 * WebSocket server for Cursor Talk to Figma MCP.
 * Source: https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp (src/socket.ts)
 */
import type { Server, ServerWebSocket } from "bun";

const channels = new Map<string, Set<ServerWebSocket<unknown>>>();

function handleConnection(ws: ServerWebSocket<unknown>) {
  console.log("New client connected");

  ws.send(JSON.stringify({
    type: "system",
    message: "Please join a channel to start chatting",
  }));

  ws.data = {};
}

const server = Bun.serve({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3055,
  fetch(req: Request, srv: Server) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const success = srv.upgrade(req, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });

    if (success) return undefined;
    return new Response("WebSocket server running", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  },
  websocket: {
    open: handleConnection,
    message(ws: ServerWebSocket<unknown>, message: string | Buffer) {
      try {
        const data = JSON.parse(message as string);

        if (data.type === "join") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            ws.send(JSON.stringify({ type: "error", message: "Channel name is required" }));
            return;
          }
          if (!channels.has(channelName)) {
            channels.set(channelName, new Set());
          }
          const channelClients = channels.get(channelName)!;
          channelClients.add(ws);

          ws.send(JSON.stringify({
            type: "system",
            message: `Joined channel: ${channelName}`,
            channel: channelName,
          }));
          ws.send(JSON.stringify({
            type: "system",
            message: { id: data.id, result: "Connected to channel: " + channelName },
            channel: channelName,
          }));

          channelClients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify({
                type: "system",
                message: "A new user has joined the channel",
                channel: channelName,
              }));
            }
          });
          return;
        }

        if (data.type === "message") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            ws.send(JSON.stringify({ type: "error", message: "Channel name is required" }));
            return;
          }
          const channelClients = channels.get(channelName);
          if (!channelClients || !channelClients.has(ws)) {
            ws.send(JSON.stringify({ type: "error", message: "You must join the channel first" }));
            return;
          }
          channelClients.forEach((client) => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({
                type: "broadcast",
                message: data.message,
                sender: client === ws ? "You" : "User",
                channel: channelName,
              }));
            }
          });
        }
      } catch (err) {
        console.error("Error handling message:", err);
      }
    },
    close(ws: ServerWebSocket<unknown>) {
      channels.forEach((clients) => clients.delete(ws));
    },
  },
});

console.log(`WebSocket server running on port ${server.port}`);
