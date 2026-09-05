import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSchema, decideOrderUpdate } from "../src/checkout_decision.js";

test("queues fulfillment and creates a receipt only after payment and reservation", () => {
  const base = {
    orderId: "order_1042",
    accountId: "shop_demo",
    paymentStatus: "paid" as const,
    inventoryReserved: true,
    email: "buyer@example.com",
    totalCents: 7499
  };

  assert.deepEqual(decideOrderUpdate(checkoutSchema.parse(base)), {
    orderId: "order_1042",
    state: "fulfillment_queued",
    receipt: { recipient: "buyer@example.com", totalCents: 7499 }
  });

  assert.deepEqual(decideOrderUpdate(checkoutSchema.parse({ ...base, inventoryReserved: false })), {
    orderId: "order_1042",
    state: "review_required",
    receipt: null
  });
});
