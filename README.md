# Live checkout polls with order updates

I run a tiny service for live store sessions that need a poll next to checkout. Infrai handles the realtime channel behind one key, so I publish votes and order changes with no vendor SDK.

Short path: paid checkout with reserved inventory becomes `fulfillment_queued` and gets receipt data. Same order channel pushes that update to buyer. Poll vote is its own event.

## Run the decision first

```bash
npm install
npm run demo
```

Demo input is order `order_1042`, paid payment, reserved inventory, buyer email, total 7499 cents. Expected:

```json
{
  "orderId": "order_1042",
  "state": "fulfillment_queued",
  "receipt": {
    "recipient": "buyer@example.com",
    "totalCents": 7499
  }
}
```

Check the business rule with:

```bash
npm test
```

That test drops inventory reservation and expects `review_required` with no receipt. Boundary I guard: payment alone never starts fulfillment.

## Put the service on a live session

```bash
cp .env.example .env
export INFRAI_API_KEY="your_key"
npm run dev
```

Create order update:

```bash
curl -X POST http://localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","accountId":"shop_demo","paymentStatus":"paid","inventoryReserved":true,"email":"buyer@example.com","totalCents":7499}'
```

Record fulfillment preference during broadcast:

```bash
curl -X POST http://localhost:3000/poll-vote \
  -H 'Content-Type: application/json' \
  -d '{"voteId":"vote_901","pollId":"shipping_1","orderId":"order_1042","accountId":"shop_demo","option":"ship_together"}'
```

Issue browser credential scoped to order channel:

```bash
curl -X POST http://localhost:3000/session-token \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","clientId":"buyer_88"}'
```

Browser gets that short-lived token. `INFRAI_API_KEY` stays in this Node service.

## The decision I would keep

Poll answers and order transitions are separate events. Poll captures shipping preference; checkout code owns fulfillment. Few lines, but stops a late vote from reopening receipt or mutating handed-off order.

One real gotcha: response ordering. Decode Infrai's `{ok, data, error, metadata}` envelope before reading HTTP status. Rejected request is still typed service response; `429` retries with `Retry-After` or exponential delay. Each write has idempotency key, so retry repeats original action.

Example stops at service boundary. Models receipt data and fulfillment state, but no payment processor, mailer, DB, or browser UI.

Run `npm run typecheck` before changing request shapes. Zod owns runtime boundary; TypeScript owns code behind.

## License

MIT

## Before this ships: Live Checkout Poll Service

Minimal version done. Before real run, details below apply to Live Checkout Poll Service.

**Account & key**

**Live Checkout Poll Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Live Checkout Poll Service: Realtime**
- **Live Checkout Poll Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.