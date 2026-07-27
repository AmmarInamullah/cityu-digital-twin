/**
 * Seed Script: Creates the YEUNG Building profile in MongoDB.
 *
 * Run with: npm run seed
 * (Requires MONGODB_URI in .env)
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import BuildingProfile from '../models/BuildingProfile';
import { YEUNG_BUILDING_PROFILE } from '../constants';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Clear existing building profiles
    await BuildingProfile.deleteMany({});
    console.log('Cleared existing building profiles');

    // Create YEUNG Building profile
    const building = await BuildingProfile.create(YEUNG_BUILDING_PROFILE);
    console.log(`Created YEUNG Building profile with ID: ${building._id}`);
    console.log(`  Name: ${building.name}`);
    console.log(`  Baseline daily kWh: ${Math.round(building.baselineDailyKwh).toLocaleString()}`);
    console.log(`  Zone breakdown:`);
    console.log(`    General Lighting & AC: ${(building.zoneBreakdown.generalLightingAC * 100).toFixed(1)}%`);
    console.log(`    Laboratory Power: ${(building.zoneBreakdown.laboratoryPower * 100).toFixed(1)}%`);
    console.log(`    Chiller Plant: ${(building.zoneBreakdown.chillerPlant * 100).toFixed(1)}%`);
    console.log(`    Other Services: ${(building.zoneBreakdown.otherBuildingServices * 100).toFixed(1)}%`);

    console.log('\nSeed complete. Save this building ID for the synthetic generator:');
    console.log(`BUILDING_ID=${building._id}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
