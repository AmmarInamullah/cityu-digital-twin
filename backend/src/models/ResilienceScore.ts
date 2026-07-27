import mongoose, { Document, Schema } from 'mongoose';

export interface IResilienceScore extends Document {
  buildingId: mongoose.Types.ObjectId;
  timestamp: Date;
  score: number; // 0-100 composite
  breakdown: {
    energyPerformance: number;      // 0-100: efficiency vs baseline
    co2Trajectory: number;          // 0-100: CO2 relative to 2030 target path
    operationalAdaptability: number; // 0-100: anomaly frequency, recovery
  };
  metadata: {
    dailyKwh: number;
    dailyCo2Kg: number;
    anomalyCount: number;
    baselineDeviation: number; // percentage above/below baseline
  };
  createdAt: Date;
}

const ResilienceScoreSchema = new Schema<IResilienceScore>(
  {
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: 'BuildingProfile',
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    breakdown: {
      energyPerformance: { type: Number, required: true, min: 0, max: 100 },
      co2Trajectory: { type: Number, required: true, min: 0, max: 100 },
      operationalAdaptability: { type: Number, required: true, min: 0, max: 100 },
    },
    metadata: {
      dailyKwh: { type: Number, required: true },
      dailyCo2Kg: { type: Number, required: true },
      anomalyCount: { type: Number, default: 0 },
      baselineDeviation: { type: Number, required: true },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ResilienceScoreSchema.index({ buildingId: 1, timestamp: -1 });

export default mongoose.model<IResilienceScore>('ResilienceScore', ResilienceScoreSchema);
