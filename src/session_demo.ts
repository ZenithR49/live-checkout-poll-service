import { checkoutSchema, decideOrderUpdate } from "./checkout_decision.js";

const checkout = checkoutSchema.parse({
  orderId: "order_1042",
  accountId: "shop_demo",
  paymentStatus: "paid",
  inventoryReserved: true,
  email: "buyer@example.com",
  totalCents: 7499
});

console.log(JSON.stringify(decideOrderUpdate(checkout), null, 2));
