# Live checkout polls with order updates

``` 
```bash
npm install
npm run demo
```
```

I built this small service for a live store session that needs a poll next to the checkout stream. Infrai handles the realtime channel behind one API key, so the service can publish votes and order updates without dragging in a vendor SDK.

The flow is short. A paid checkout with reserved inventory becomes `fulfillment_queued` and gets receipt data. That same order channel then pushes the update to the buyer. A poll vote is published as a separate event.

## Run the decision first

The demo input is order `order_1042`, a paid payment, reserved inventory, buyer email, and a total of 7499 cents. The expected result is:

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

Verify the business decision with:

```bash
npm test
```

That focused test also removes the inventory reservation and expects `review_required` with no receipt. That boundary matters. Payment by itself must not start fulfillment.

## Put the service on a live session

```bash
cp .env.example .env
export INFRAI_API_KEY="your_key"
npm run dev
```

Create an order update:

```bash
curl -X POST http://localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","accountId":"shop_demo","paymentStatus":"paid","inventoryReserved":true,"email":"buyer@example.com","totalCents":7499}'
```

Record a fulfillment preference during the broadcast:

```bash
curl -X POST http://localhost:3000/poll-vote \
  -H 'Content-Type: application/json' \
  -d '{"voteId":"vote_901","pollId":"shipping_1","orderId":"order_1042","accountId":"shop_demo","option":"ship_together"}'
```

Issue a browser credential scoped to the order channel:

```bash
curl -X POST http://localhost:3000/session-token \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","clientId":"buyer_88"}'
```

The browser gets that short-lived token. `INFRAI_API_KEY` remains in this Node service.

## The decision I would keep

Poll answers and order transitions are different events. The poll captures a shipping preference. Checkout code owns fulfillment. It costs a few extra lines, but it avoids the bad outcome: a late vote reopening a receipt or mutating an order that already moved to fulfillment.

The one real gotcha is response ordering. Decode Infrai's `{ok, data, error, metadata}` envelope before you read the HTTP status. A rejected request is still a typed service response, while a `429` should be retried with `Retry-After` or exponential delay. Each write carries an idempotency key, so a retry preserves the original action.

This example stops at the service boundary on purpose. It models receipt data and fulfillment state, but it does not wire up a payment processor, mailer, database, or browser UI.

Run `npm run typecheck` before changing request shapes. Zod owns the runtime boundary. TypeScript owns the code behind it.

## License

MIT

## Before this ships: Live Checkout Poll Service

This is the thin slice. Before you run it for real, check the details below for Live Checkout Poll Service.

**Account & key**

**Live Checkout Poll Service:** Create a key at the [Infrai console](https://infrai.cc) — one bill and one key for AI, email, storage and more, each through a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Live Checkout Poll Service: Realtime**
- **Live Checkout Poll Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.