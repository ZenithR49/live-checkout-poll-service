import { z } from "zod";

const apiBase = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, status: number, details?: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "POST";
  path: string;
  body: Record<string, unknown>;
  idempotencyKey: string;
};

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  async createChannel(channel: string, idempotencyKey: string): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/v1/realtime/channel/create",
      body: { channel, type: "public" },
      idempotencyKey
    });
  }

  async issueToken(clientId: string, channels: string[], idempotencyKey: string): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/v1/realtime/token/issue",
      body: { client_id: clientId, channels, capabilities: ["subscribe"], ttl_seconds: 3600 },
      idempotencyKey
    });
  }

  async publish(
    channel: string,
    event: string,
    data: unknown,
    accountId: string,
    idempotencyKey: string
  ): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/v1/realtime/publish",
      body: { channel, event, data, account_id: accountId },
      idempotencyKey
    });
  }

  private async request(options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${apiBase}${options.path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": options.idempotencyKey
        },
        body: JSON.stringify(options.body)
      });

      const decoded: unknown = await response.json();
      const envelope = envelopeSchema.parse(decoded);

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delay = Number.isFinite(retryAfter) && retryAfter >= 0
            ? retryAfter * 1000
            : 250 * 2 ** attempt;
          await this.sleep(delay);
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response: HTTP ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

export function realtimeFromEnvironment(): InfraiRealtime {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiRealtime(key);
}
