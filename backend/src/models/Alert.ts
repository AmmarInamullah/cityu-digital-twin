import mongoose, { Document, Schema } from 'mongoose';

export interface IAlert extends Document {
  buildingId: mongoose.Types.ObjectId;
  timestamp: Date;
  type: 'anomaly' | 'threshold_breach';
  severity: 'low' | 'medium' | 'high';
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: {
    actualValue?: number;
    expectedValue?: number;
    residual?: number;
    zoneId?: string;
  };
  createdAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: 'BuildingProfile',
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['anomaly', 'threshold_breach'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    metadata: {
      actualValue: Number,
      expectedValue: Number,
      residual: Number,
      zoneId: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AlertSchema.index({ buildingId: 1, resolved: 1, timestamp: -1 });

export default mongoose.model<IAlert>('Alert', AlertSchema);
