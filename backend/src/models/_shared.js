import mongoose from 'mongoose';

// Common schema options: timestamps, virtuals in JSON, no __v / duplicate id
export const schemaOptions = (extra = {}) => ({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret.id;
      return ret;
    },
  },
  toObject: { virtuals: true, versionKey: false },
  ...extra,
});

export const hotelRef = { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true };
