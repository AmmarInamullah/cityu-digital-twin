/**
 * Equipment Library
 * =================
 *
 * Real wattages and duty cycles. Sources:
 * - Lighting: manufacturer specs at equal light output (~800 lumens)
 * - People: ASHRAE Fundamentals Ch.18, seated light work = 75 W sensible
 * - Appliances: ENERGY STAR / manufacturer nameplate
 * - Fume hood: ASHRAE Laboratory Design Guide (fan + reheat)
 *
 * IMPORTANT: `watts` is electrical power draw. `heatWatts` is heat released
 * into the room. For electrical equipment these are equal (First Law: all
 * electrical energy in a room becomes heat). For people, watts = 0 because
 * people consume no electricity but DO generate heat.
 */

export type EquipmentCategory = 'lighting' | 'cooling' | 'computing' | 'appliance' | 'specialist' | 'occupant';

export interface Equipment {
  id: string;
  name: string;
  shortName: string;
  category: EquipmentCategory;
  /** Electrical power draw in watts (0 for people) */
  watts: number;
  /** Heat released into room in watts */
  heatWatts: number;
  /** Fraction of the day this is actually drawing power (0-1) */
  dutyCycle: number;
  /** Default operating hours per day, used for daily energy */
  hoursPerDay: number;
  /** For lighting: light output in lumens, so we can compare fairly */
  lumens?: number;
  /** For AC: cooling capacity in watts of heat removed */
  coolingCapacityW?: number;
  /** For AC: coefficient of performance (heat removed per watt of electricity) */
  cop?: number;
  /** For fans: perceived temperature reduction in degrees C from air movement */
  perceivedCoolingC?: number;
  /** Icon character for the isometric view */
  icon: string;
  color: string;
  /** Teaching note shown on hover */
  note: string;
}

export const EQUIPMENT_LIBRARY: Equipment[] = [
  // ---------- LIGHTING (all at ~800 lumens for fair comparison) ----------
  {
    id: 'bulb_incandescent',
    name: 'Incandescent Bulb (60 W)',
    shortName: 'Incandescent',
    category: 'lighting',
    watts: 60, heatWatts: 60, dutyCycle: 1, hoursPerDay: 10, lumens: 800,
    icon: '\u25CF', color: '#fbbf24',
    note: '800 lumens for 60 W. About 95 percent of the energy becomes heat, not light.',
  },
  {
    id: 'bulb_cfl',
    name: 'CFL Bulb (14 W)',
    shortName: 'CFL',
    category: 'lighting',
    watts: 14, heatWatts: 14, dutyCycle: 1, hoursPerDay: 10, lumens: 800,
    icon: '\u25CF', color: '#a3e635',
    note: 'Same 800 lumens for 14 W. Roughly a quarter of the incandescent draw.',
  },
  {
    id: 'bulb_led',
    name: 'LED Bulb (9 W)',
    shortName: 'LED',
    category: 'lighting',
    watts: 9, heatWatts: 9, dutyCycle: 1, hoursPerDay: 10, lumens: 800,
    icon: '\u25CF', color: '#2dd4bf',
    note: 'Same 800 lumens for 9 W. Saves 51 W directly plus about 16 W of cooling you no longer need.',
  },
  {
    id: 'light_fluorescent_tube',
    name: 'Fluorescent Tube (36 W)',
    shortName: 'Tube light',
    category: 'lighting',
    watts: 36, heatWatts: 36, dutyCycle: 1, hoursPerDay: 10, lumens: 3000,
    icon: '\u2582', color: '#93c5fd',
    note: 'Typical office and classroom fitting. An LED tube equivalent draws about 18 W.',
  },

  // ---------- COOLING ----------
  {
    id: 'fan_ceiling',
    name: 'Ceiling Fan',
    shortName: 'Ceiling fan',
    category: 'cooling',
    watts: 50, heatWatts: 50, dutyCycle: 1, hoursPerDay: 10,
    perceivedCoolingC: 2.5,
    icon: '\u2735', color: '#60a5fa',
    note: 'Does not cool the air, it adds 50 W of heat. But air movement makes the room feel about 2.5 C cooler, which can let you raise the AC setpoint.',
  },
  {
    id: 'ac_split_2500',
    name: 'Split AC (2.5 kW cooling)',
    shortName: 'AC 2.5 kW',
    category: 'cooling',
    watts: 0, heatWatts: 0, dutyCycle: 1, hoursPerDay: 10,
    coolingCapacityW: 2500, cop: 3.2,
    icon: '\u2744', color: '#38bdf8',
    note: 'Removes 2500 W of heat. Its electricity use depends on the actual load: heat removed divided by COP of 3.2.',
  },
  {
    id: 'ac_split_3500',
    name: 'Split AC (3.5 kW cooling)',
    shortName: 'AC 3.5 kW',
    category: 'cooling',
    watts: 0, heatWatts: 0, dutyCycle: 1, hoursPerDay: 10,
    coolingCapacityW: 3500, cop: 3.2,
    icon: '\u2744', color: '#38bdf8',
    note: 'Removes 3500 W of heat at a COP of 3.2.',
  },
  {
    id: 'ac_split_5000',
    name: 'Split AC (5.0 kW cooling)',
    shortName: 'AC 5.0 kW',
    category: 'cooling',
    watts: 0, heatWatts: 0, dutyCycle: 1, hoursPerDay: 10,
    coolingCapacityW: 5000, cop: 3.0,
    icon: '\u2744', color: '#0ea5e9',
    note: 'Larger units often have slightly lower COP. Oversizing wastes capital and causes short cycling.',
  },
  {
    id: 'ac_inverter_3500',
    name: 'Inverter AC (3.5 kW, COP 4.2)',
    shortName: 'Inverter AC',
    category: 'cooling',
    watts: 0, heatWatts: 0, dutyCycle: 1, hoursPerDay: 10,
    coolingCapacityW: 3500, cop: 4.2,
    icon: '\u2744', color: '#2dd4bf',
    note: 'Variable speed compressor. Same cooling as the 3.5 kW unit but about 24 percent less electricity.',
  },

  // ---------- COMPUTING ----------
  {
    id: 'desktop_pc',
    name: 'Desktop PC + Monitor',
    shortName: 'Desktop',
    category: 'computing',
    watts: 180, heatWatts: 180, dutyCycle: 0.7, hoursPerDay: 9,
    icon: '\u25A3', color: '#a78bfa',
    note: 'Around 150 W for the tower plus 30 W for the monitor. Duty cycle allows for idle periods.',
  },
  {
    id: 'laptop',
    name: 'Laptop',
    shortName: 'Laptop',
    category: 'computing',
    watts: 50, heatWatts: 50, dutyCycle: 0.6, hoursPerDay: 9,
    icon: '\u25AD', color: '#c4b5fd',
    note: 'Roughly a third of a desktop. Replacing desktops with laptops is a real and often overlooked saving.',
  },
  {
    id: 'projector',
    name: 'Projector',
    shortName: 'Projector',
    category: 'computing',
    watts: 300, heatWatts: 300, dutyCycle: 1, hoursPerDay: 4,
    icon: '\u25B7', color: '#f472b6',
    note: 'A significant point load in classrooms. Often left on between classes.',
  },
  {
    id: 'server_rack',
    name: 'Small Server Rack',
    shortName: 'Server rack',
    category: 'computing',
    watts: 1500, heatWatts: 1500, dutyCycle: 1, hoursPerDay: 24,
    icon: '\u2338', color: '#f87171',
    note: 'Runs 24 hours a day and every watt becomes heat that must be removed. The cooling penalty roughly adds another 470 W.',
  },

  // ---------- APPLIANCES ----------
  {
    id: 'fridge_small',
    name: 'Small Fridge',
    shortName: 'Fridge',
    category: 'appliance',
    watts: 100, heatWatts: 100, dutyCycle: 0.35, hoursPerDay: 24,
    icon: '\u25AF', color: '#94a3b8',
    note: 'Compressor cycles on about 35 percent of the time. Rejects its heat into the room it is cooling from.',
  },
  {
    id: 'kettle',
    name: 'Electric Kettle (2 kW)',
    shortName: 'Kettle',
    category: 'appliance',
    watts: 2000, heatWatts: 2000, dutyCycle: 0.02, hoursPerDay: 0.5,
    icon: '\u25B2', color: '#fb923c',
    note: 'Huge instantaneous power but tiny daily energy. This is the clearest illustration that power is not energy.',
  },
  {
    id: 'water_dispenser',
    name: 'Hot/Cold Water Dispenser',
    shortName: 'Water dispenser',
    category: 'appliance',
    watts: 500, heatWatts: 500, dutyCycle: 0.25, hoursPerDay: 24,
    icon: '\u2617', color: '#fdba74',
    note: 'Modest power but runs all day, so annual energy is often higher than people expect.',
  },

  // ---------- SPECIALIST ----------
  {
    id: 'fume_hood',
    name: 'Lab Fume Hood',
    shortName: 'Fume hood',
    category: 'specialist',
    watts: 800, heatWatts: 400, dutyCycle: 1, hoursPerDay: 24,
    icon: '\u2b1a', color: '#ef4444',
    note: 'Fan plus reheat. It also exhausts conditioned air continuously, which is why labs have such high energy intensity.',
  },
  {
    id: 'lab_freezer',
    name: 'Ultra-Low Freezer (-80 C)',
    shortName: 'ULT freezer',
    category: 'specialist',
    watts: 900, heatWatts: 900, dutyCycle: 0.6, hoursPerDay: 24,
    icon: '\u25A2', color: '#dc2626',
    note: 'One of the highest single loads in any research building. Runs continuously for years.',
  },

  // ---------- OCCUPANTS ----------
  {
    id: 'person',
    name: 'Person (seated, light work)',
    shortName: 'Person',
    category: 'occupant',
    watts: 0, heatWatts: 75, dutyCycle: 1, hoursPerDay: 8,
    icon: '\u263A', color: '#fcd34d',
    note: 'Uses no electricity but gives off about 75 W of sensible heat. Thirty people is a 2.25 kW heat load the AC must remove.',
  },
];

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  lighting: 'Lighting',
  cooling: 'Cooling & Ventilation',
  computing: 'Computing & AV',
  appliance: 'Appliances',
  specialist: 'Specialist / Lab',
  occupant: 'Occupants',
};

export function getEquipment(id: string): Equipment | undefined {
  return EQUIPMENT_LIBRARY.find(e => e.id === id);
}

// ---------- Building fabric options ----------

export interface WallOption { id: string; name: string; uValue: number; note: string; }

export const WALL_OPTIONS: WallOption[] = [
  { id: 'uninsulated', name: 'Uninsulated concrete', uValue: 2.0, note: 'Typical of older Hong Kong construction' },
  { id: 'standard', name: 'Standard insulation', uValue: 1.0, note: 'Current building code baseline' },
  { id: 'improved', name: 'Improved insulation', uValue: 0.5, note: 'Retrofit target' },
  { id: 'high_performance', name: 'High performance', uValue: 0.25, note: 'Passive-house grade' },
];

export const GLAZING_OPTIONS: WallOption[] = [
  { id: 'single', name: 'Single glazed', uValue: 5.7, note: 'SHGC 0.80. Common in older buildings' },
  { id: 'double', name: 'Double glazed', uValue: 2.8, note: 'SHGC 0.65' },
  { id: 'low_e', name: 'Low-E double glazed', uValue: 1.6, note: 'SHGC 0.35. Cuts solar gain sharply' },
];

export const GLAZING_SHGC: Record<string, number> = {
  single: 0.80,
  double: 0.65,
  low_e: 0.35,
};

/** Peak solar irradiance on a vertical surface by orientation, Hong Kong summer (W/m2) */
export const ORIENTATION_SOLAR: Record<string, { peak: number; dailyFactor: number; label: string }> = {
  north: { peak: 110, dailyFactor: 0.30, label: 'North (diffuse only)' },
  east: { peak: 350, dailyFactor: 0.22, label: 'East (morning peak)' },
  south: { peak: 250, dailyFactor: 0.28, label: 'South' },
  west: { peak: 400, dailyFactor: 0.22, label: 'West (afternoon peak, worst)' },
};
