import mongoose from 'mongoose';

// Named sequences, e.g. "booking:<hotelId>:2026" → 1, 2, 3…
const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { versionKey: false }
);

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSeq(key, session) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return doc.seq;
}
