import mongoose, { Document, Schema } from 'mongoose';

export interface IBuildingProfile extends Document {
  name: string;
  location: string;
  gridProvider: 'CLP' | 'HKElectric';
  floorAreaSqm: number;
  baselineDailyKwh: number;
  baselineYear: string;
  zoneBreakdown: {
    generalLightingAC: number;
    laboratoryPower: number;
    chillerPlant: number;
    otherBuildingServices: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BuildingProfileSchema = new Schema<IBuildingProfile>(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    gridProvider: {
      type: String,
      enum: ['CLP', 'HKElectric'],
      required: true,
    },
    floorAreaSqm: { type: Number, required: true },
    baselineDailyKwh: { type: Number, required: true },
    baselineYear: { type: String, required: true },
    zoneBreakdown: {
      generalLightingAC: { type: Number, required: true },
      laboratoryPower: { type: Number, required: true },
      chillerPlant: { type: Number, required: true },
      otherBuildingServices: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IBuildingProfile>('BuildingProfile', BuildingProfileSchema);
