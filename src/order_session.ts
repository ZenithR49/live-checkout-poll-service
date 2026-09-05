import { createServer, type ServerResponse } from "node:http";
import { z, ZodError } from "zod";
import { checkoutSchema, decideOrderUpdate } from "./checkout_decision.js";
import { InfraiError, realtimeFromEnvironment } from "./infrai_realtime.js";

const voteSchema = z.object({
  voteId: z.string().min(1),
  pollId: z.string().min(1),
  orderId: z.string().min(1),
  accountId: z.string().min(1),
  option: z.enum(["ship_together", "ship_available_items"])
}).strict();

const tokenSchema = z.object({
  orderId: z.string().min(1),
  clientId: z.string().min(1)
}).strict();

const realtime = realtimeFromEnvironment();

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function bodyOf(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "POST") return send(response, 404, { error: "route_not_found" });
    const body = await bodyOf(request);

    if (request.url === "/checkout") {
      const checkout = checkoutSchema.parse(body);
      const update = decideOrderUpdate(checkout);
      const channel = `orders:${checkout.orderId}`;
      await realtime.createChannel(channel, `channel:${checkout.orderId}`);
      await realtime.publish(channel, "order.updated", update, checkout.accountId, `checkout:${checkout.orderId}`);
      return send(response, 202, update);
    }

    if (request.url === "/poll-vote") {
      const vote = voteSchema.parse(body);
      const channel = `orders:${vote.orderId}`;
      const result = { pollId: vote.pollId, option: vote.option, voteId: vote.voteId };
      await realtime.publish(channel, "poll.vote.recorded", result, vote.accountId, `vote:${result.voteId}`);
      return send(response, 202, result);
    }

    if (request.url === "/session-token") {
      const input = tokenSchema.parse(body);
      const token = await realtime.issueToken(input.clientId, [`orders:${input.orderId}`], `token:${input.clientId}:${input.orderId}`);
      return send(response, 200, token);
    }

    return send(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return send(response, 400, { error: "invalid_request" });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.code });
    }
    return send(response, 500, { error: "service_error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Order session service listening on http://localhost:${port}`));
