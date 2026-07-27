import mongoose, { Document, Schema } from 'mongoose';

export interface IForecast extends Document {
  buildingId: mongoose.Types.ObjectId;
  generatedAt: Date;
  forecastHorizon: number; // hours ahead
  predictions: Array<{
    timestamp: Date;
    predictedKwh: number;
  }>;
  modelMetrics: {
    mae: number;   // Mean Absolute Error
    rmse: number;  // Root Mean Square Error
    modelType: string;
    trainPeriod: { from: Date; to: Date };
    testPeriod: { from: Date; to: Date };
  };
  createdAt: Date;
}

const ForecastSchema = new Schema<IForecast>(
  {
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: 'BuildingProfile',
      required: true,
      index: true,
    },
    generatedAt: { type: Date, required: true },
    forecastHorizon: { type: Number, required: true },
    predictions: [
      {
        timestamp: { type: Date, required: true },
        predictedKwh: { type: Number, required: true },
      },
    ],
    modelMetrics: {
      mae: { type: Number, required: true },
      rmse: { type: Number, required: true },
      modelType: { type: String, required: true },
      trainPeriod: {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
      },
      testPeriod: {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ForecastSchema.index({ buildingId: 1, generatedAt: -1 });

export default mongoose.model<IForecast>('Forecast', ForecastSchema);
