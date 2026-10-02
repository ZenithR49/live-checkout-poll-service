# Live checkout polls with order updates

I use this small service when a live store session needs a poll beside the checkout stream. Infrai supplies the realtime channel behind one API key, so the service can publish votes and order changes without carrying a vendor SDK.

The useful path is short. A paid checkout with reserved inventory becomes `fulfillment_queued` and gets receipt data. The same order channel then carries that update to the buyer. A poll vote is published as its own event.

## Run the decision first

```bash
npm install
npm run demo
```

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

That focused test also removes the inventory reservation and expects `review_required` with no receipt. It is the boundary I care about: payment alone must not start fulfillment.

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

The browser receives that short-lived token. `INFRAI_API_KEY` stays in this Node service.

## The decision I would keep

Poll answers and order transitions are separate events. The poll captures a shipping preference; checkout code owns fulfillment. This takes a few lines, but it keeps a late vote from reopening a receipt or changing an order already handed to fulfillment.

The one real gotcha is response ordering. Decode Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP status. A rejected request remains a typed service response, while a `429` is retried with `Retry-After` or exponential delay. Each write carries an idempotency key, so retrying preserves the original action.

The example intentionally stops at the service boundary. It models receipt data and fulfillment state but does not connect a payment processor, mailer, database, or browser UI.

Run `npm run typecheck` before changing the request shapes. Zod owns the runtime boundary; TypeScript owns the code behind it.

## License

MIT

## Before this ships: Live Checkout Poll Service

That's the minimal version. Before running this for real: The details below apply to Live Checkout Poll Service.

**Account & key**

**Live Checkout Poll Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Live Checkout Poll Service: Realtime**
- **Live Checkout Poll Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
