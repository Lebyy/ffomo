import { z } from "zod";
import { db } from "./mongo";

export const decisionPutSchema = z.object({
  at: z.number().int().positive(),
  item: z.looseObject({
    id: z.string().trim().min(8).max(80),
    decision: z.string().trim().min(1).max(1000),
  }),
});

type Row = {
  _id: string;
  userId: string;
  at: number;
  item: Record<string, unknown>;
};

async function rows() {
  const base = await db();
  return base ? base.collection<Row>("decisions") : null;
}

export async function listDecisions(userId: string) {
  const col = await rows();
  if (!col) return null;
  const found = await col.find({ userId }).sort({ at: -1 }).limit(100).toArray();
  return found.map((row) => row.item);
}

// Older writes lose to newer ones, so two quick taps can't land out of order.
export async function putDecision(userId: string, body: z.infer<typeof decisionPutSchema>) {
  const col = await rows();
  if (!col) return false;
  const _id = `${userId}:${body.item.id}`;
  try {
    await col.updateOne(
      { _id, at: { $lt: body.at } },
      { $set: { userId, at: body.at, item: body.item } },
      { upsert: true },
    );
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  return true;
}

export async function removeDecision(userId: string, id: string) {
  const col = await rows();
  if (!col) return false;
  await col.deleteOne({ _id: `${userId}:${id}`, userId });
  return true;
}
