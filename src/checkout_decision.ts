import { z } from "zod";

export const checkoutSchema = z.object({
  orderId: z.string().min(1),
  accountId: z.string().min(1),
  paymentStatus: z.enum(["paid", "pending"]),
  inventoryReserved: z.boolean(),
  email: z.string().email(),
  totalCents: z.number().int().nonnegative()
}).strict();

export type Checkout = z.infer<typeof checkoutSchema>;

export type OrderUpdate = {
  orderId: string;
  state: "fulfillment_queued" | "review_required";
  receipt: { recipient: string; totalCents: number } | null;
};

export function decideOrderUpdate(checkout: Checkout): OrderUpdate {
  const ready = checkout.paymentStatus === "paid" && checkout.inventoryReserved;
  return {
    orderId: checkout.orderId,
    state: ready ? "fulfillment_queued" : "review_required",
    receipt: ready ? { recipient: checkout.email, totalCents: checkout.totalCents } : null
  };
}
