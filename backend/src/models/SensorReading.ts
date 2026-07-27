import mongoose, { Document, Schema } from 'mongoose';

export interface ISensorReading extends Document {
  buildingId: mongoose.Types.ObjectId;
  timestamp: Date;
  metricType: 'energy_kwh' | 'occupancy' | 'temperature';
  value: number;
  zoneId?: string;
  isRealSensor: boolean;
  createdAt: Date;
}

const SensorReadingSchema = new Schema<ISensorReading>(
  {
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: 'BuildingProfile',
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    metricType: {
      type: String,
      enum: ['energy_kwh', 'occupancy', 'temperature'],
      required: true,
      index: true,
    },
    value: { type: Number, required: true },
    zoneId: { type: String },
    isRealSensor: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for the most common query pattern
SensorReadingSchema.index({ buildingId: 1, metricType: 1, timestamp: -1 });
SensorReadingSchema.index({ buildingId: 1, zoneId: 1, timestamp: -1 });

export default mongoose.model<ISensorReading>('SensorReading', SensorReadingSchema);
