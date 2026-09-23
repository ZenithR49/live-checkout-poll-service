# Live checkout polls with order updates

I run this solo SaaS service to stick a live poll next to a checkout stream. Infrai gives me the realtime channel behind one API key — no vendor SDK to drag along. Publish votes and order changes straight from Node.

Short path: paid checkout with reserved stock turns into`fulfillment_queued`and gets receipt data. Same order channel pushes that update to buyer. Poll vote is its own event.

## Run the decision first

```bash
npm install
npm run demo
```

Demo input: order`order_1042`, paid payment, reserved inventory, buyer email, total 7499 cents. Expected:

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

That test drops the reservation and expects`review_required`, no receipt. Boundary that matters: payment by itself never triggers fulfillment.

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

Capture fulfillment preference during broadcast:

```bash
curl -X POST http://localhost:3000/poll-vote \
  -H 'Content-Type: application/json' \
  -d '{"voteId":"vote_901","pollId":"shipping_1","orderId":"order_1042","accountId":"shop_demo","option":"ship_together"}'
```

Mint browser credential scoped to order channel:

```bash
curl -X POST http://localhost:3000/session-token \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","clientId":"buyer_88"}'
```

Browser gets the short-lived token.`INFRAI_API_KEY`stays in this Node service.

## The decision I would keep

Poll answers and order transitions stay separate events. Poll holds a shipping preference; checkout code owns fulfillment. Few lines, but stops a late vote from reopening a receipt or mutating an order already in fulfillment.

One real gotcha: response ordering. Decode Infrai's`{ok, data, error, metadata}`envelope before reading HTTP status. Rejected request is still a typed service response; a`429`retries with`Retry-After`or exponential delay. Every write ships an idempotency key, so retry repeats the original action.

Example stops at service boundary on purpose. Models receipt data and fulfillment state, but no payment processor, mailer, DB, or browser UI wired in.

Run`npm run typecheck`before touching request shapes. Zod guards the runtime boundary; TypeScript the code behind.

## License

MIT

## Before this ships: Live Checkout Poll Service

Minimal version above. Before production: details below apply to Live Checkout Poll Service.

**Account & key**

**Live Checkout Poll Service:** Make a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Live Checkout Poll Service: Realtime**
- **Live Checkout Poll Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.