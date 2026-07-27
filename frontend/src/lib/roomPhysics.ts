/**
 * Room Thermal & Electrical Physics Engine
 * =========================================
 *
 * Every equation here is traceable to ASHRAE Fundamentals. Nothing is invented.
 *
 * CORE INSIGHT THE MODEL TEACHES:
 * All electrical energy consumed inside a room becomes heat (First Law).
 * The air conditioner must then remove that heat, and it does so at a
 * Coefficient of Performance (COP) of roughly 3 to 4. So removing 3 kW of
 * heat costs about 1 kW of electricity.
 *
 * Consequence: adding a 100 W lamp does not add 100 W to the building.
 * It adds 100 W plus roughly 31 W of extra cooling work, so about 131 W.
 * This "cooling penalty" is why LED retrofits save more than the lamp
 * wattage difference suggests.
 *
 * HEAT BALANCE
 *   Q_total = Q_equipment + Q_people + Q_solar + Q_conduction + Q_ventilation
 *
 *   Q_conduction  = UA * (T_outdoor - T_indoor)                  [W]
 *   Q_ventilation = 0.33 * ACH * Volume * (T_out - T_in)         [W]
 *      derived from Q = rho * cp * V_dot * dT with
 *      rho = 1.2 kg/m3, cp = 1005 J/kgK  ->  0.335 W/(m3.K.ACH)
 *
 * STEADY-STATE INDOOR TEMPERATURE
 *   Let K = UA + 0.33 * ACH * Volume        [W/K]  total conductance
 *   Q_gain(T_in) = Q_internal + Q_solar + K * (T_out - T_in)
 *
 *   With the AC removing Q_ac at equilibrium:
 *     T_in = T_out + (Q_internal + Q_solar - Q_ac) / K
 *
 *   If installed AC capacity is sufficient, T_in = setpoint and
 *     Q_ac_required = Q_internal + Q_solar + K * (T_out - T_setpoint)
 *   If capacity is insufficient, T_in floats above setpoint per the equation above.
 *
 * ASSUMPTIONS (stated openly)
 *   - Steady state. No thermal mass or transient response.
 *   - Floor and ceiling are adiabatic: this is an internal room in a
 *     multi-storey building, so it only exchanges heat through its
 *     external walls and windows.
 *   - Sensible heat only. Latent (humidity) load is not modelled, which
 *     understates real Hong Kong cooling loads by roughly 20 to 30 percent.
 *   - Lighting and equipment heat is 100 percent convective to room air.
 */

import {
  Equipment, getEquipment, GLAZING_SHGC, ORIENTATION_SOLAR,
} from './equipmentLibrary';

// ---------- Physical constants ----------
/** Air volumetric heat capacity term: rho * cp / 3600 = 1.2 * 1005 / 3600 */
export const AIR_VOL_HEAT_CAP = 0.335; // W per (m3 * K * ACH)
/** ASHRAE sensible heat, seated light work */
export const PERSON_SENSIBLE_W = 75;
/**
 * Internal partition U-value, W/m2K. A 100 mm block or studwork partition
 * with plaster finishes, including both internal surface resistances.
 */
export const INTERNAL_PARTITION_U = 2.0;
/**
 * Floor and ceiling slab U-value, W/m2K. Concrete slab with typical
 * finishes, heat exchanged with the storeys above and below.
 */
export const SLAB_U = 1.2;
/** CLP Hong Kong annual average grid emission factor */
export const CO2_FACTOR_KG_PER_KWH = 0.34;
/** Comfort band, ASHRAE 55 for cooling season */
export const COMFORT_MIN_C = 23;
export const COMFORT_MAX_C = 26;

// ---------- Types ----------

export interface RoomGeometry {
  widthM: number;
  depthM: number;
  heightM: number;
  /** How many of the four walls are external (exposed to outdoor air) */
  externalWalls: 1 | 2 | 3 | 4;
  /** Total glazed area in m2 across the external walls */
  windowAreaM2: number;
  orientation: 'north' | 'east' | 'south' | 'west';
}

export interface RoomFabric {
  wallUValue: number;
  glazingId: string;
  glazingUValue: number;
  /** Air changes per hour */
  ach: number;
  /** Effective thermal capacitance, kJ per m2 of floor per K. Defaults to 80 (medium weight). */
  thermalMassKjPerM2K?: number;
  /**
   * Temperature of the spaces surrounding this room: the corridor, the rooms
   * either side, and the storeys above and below. Defaults to 26 C, a typical
   * conditioned building interior. Set equal to the outdoor temperature to
   * model a room surrounded by unconditioned space.
   */
  adjacentSpaceTempC?: number;
}

export interface AdjacentSpaceOption { id: string; name: string; tempC: number | 'outdoor'; note: string; }

export const ADJACENT_SPACE_OPTIONS: AdjacentSpaceOption[] = [
  { id: 'conditioned', name: 'Conditioned spaces (26 C)', tempC: 26, note: 'Surrounded by other air-conditioned rooms' },
  { id: 'semi', name: 'Semi-conditioned (29 C)', tempC: 29, note: 'Corridors, lobbies, lightly cooled circulation' },
  { id: 'unconditioned', name: 'Unconditioned (outdoor temp)', tempC: 'outdoor', note: 'Plant rooms, car park, or a standalone structure' },
];

export interface RoomConditions {
  outdoorTempC: number;
  setpointTempC: number;
  /** Hourly scaling of solar gain, 0-1. Defaults to 1 (design hour, peak sun). */
  solarMultiplier?: number;
}

export interface PlacedItem {
  uid: string;
  equipmentId: string;
  /** Grid cell coordinates */
  gx: number;
  gz: number;
}

export interface RoomState {
  geometry: RoomGeometry;
  fabric: RoomFabric;
  conditions: RoomConditions;
  items: PlacedItem[];
}

export interface LoadComponent {
  label: string;
  watts: number;
  color: string;
}

export interface SimulationResult {
  // --- Heat balance ---
  /** Heat from electrical equipment and lighting, W */
  qEquipmentW: number;
  /** Heat from occupants, W */
  qPeopleW: number;
  /** Solar gain through glazing at design hour, W */
  qSolarW: number;
  /** Conduction through walls and glazing, W (positive = gain) */
  qConductionW: number;
  /** Ventilation and infiltration, W (positive = gain) */
  qVentilationW: number;
  /** Total heat that must be removed, W */
  qTotalW: number;

  // --- Cooling ---
  /** Installed cooling capacity, W of heat removal */
  acCapacityW: number;
  /** Heat actually removed by AC, W */
  acDeliveredW: number;
  /** Electricity the AC draws, W */
  acElectricalW: number;
  /** Effective COP of the installed units */
  effectiveCop: number;
  /** True when installed capacity cannot meet the load */
  acUndersized: boolean;

  // --- Electrical ---
  /** Non-AC electrical draw at design conditions, W */
  directElectricalW: number;
  /** Total electrical draw including AC, W */
  totalElectricalW: number;
  /** The extra electricity the AC draws purely to remove equipment heat, W */
  coolingPenaltyW: number;

  // --- Temperature & comfort ---
  /** Steady-state indoor air temperature, C */
  indoorTempC: number;
  /** Temperature as it feels, accounting for fan air movement, C */
  perceivedTempC: number;
  comfortStatus: 'comfortable' | 'warm' | 'hot' | 'cold';

  // --- Energy & carbon ---
  /** Daily electrical energy using per-item operating hours, kWh */
  dailyKwh: number;
  dailyCo2Kg: number;
  annualKwh: number;
  annualCo2Kg: number;

  // --- Intensity metrics ---
  floorAreaM2: number;
  volumeM3: number;
  /** Heat density on the floor, W/m2. Drives the visual gradient. */
  heatDensityWPerM2: number;
  /** Electrical power density, W/m2. Comparable to building EUI benchmarks. */
  powerDensityWPerM2: number;
  /** Annual energy use intensity, kWh/m2/yr. Directly comparable to portfolio EUI. */
  euiKwhPerM2Yr: number;

  // --- Breakdown for charts ---
  loadBreakdown: LoadComponent[];
  /** Total conductance K, W/K */
  conductanceWPerK: number;
  occupantCount: number;
}

// ---------- Helper ----------

function wallGrossArea(g: RoomGeometry): number {
  // Perimeter walls: two of width, two of depth. Take the requested number
  // of external walls, alternating width/depth for a sensible average.
  const areas = [
    g.widthM * g.heightM,
    g.depthM * g.heightM,
    g.widthM * g.heightM,
    g.depthM * g.heightM,
  ];
  return areas.slice(0, g.externalWalls).reduce((a, b) => a + b, 0);
}

// ---------- Main simulation ----------

export function simulateRoom(state: RoomState): SimulationResult {
  const { geometry: g, fabric: f, conditions: c, items } = state;

  const floorAreaM2 = g.widthM * g.depthM;
  const volumeM3 = floorAreaM2 * g.heightM;

  // ----- 1. Internal gains from equipment and people -----
  let qEquipmentW = 0;
  let qPeopleW = 0;
  let directElectricalW = 0;
  let acCapacityW = 0;
  let acWeightedCopNumerator = 0;
  let perceivedCoolingC = 0;
  let occupantCount = 0;

  const categoryWatts: Record<string, number> = {};

  for (const item of items) {
    const eq = getEquipment(item.equipmentId);
    if (!eq) continue;

    if (eq.category === 'occupant') {
      qPeopleW += eq.heatWatts;
      occupantCount += 1;
      continue;
    }

    // Air conditioners contribute capacity, not a fixed draw
    if (eq.coolingCapacityW) {
      acCapacityW += eq.coolingCapacityW;
      acWeightedCopNumerator += eq.coolingCapacityW * (eq.cop ?? 3.2);
      continue;
    }

    // Everything else: electrical draw at design conditions, all of it heat
    const designW = eq.watts * eq.dutyCycle;
    directElectricalW += designW;
    qEquipmentW += eq.heatWatts * eq.dutyCycle;
    categoryWatts[eq.category] = (categoryWatts[eq.category] ?? 0) + designW;

    if (eq.perceivedCoolingC) {
      // Multiple fans give diminishing returns
      perceivedCoolingC = Math.max(perceivedCoolingC, eq.perceivedCoolingC);
    }
  }

  const effectiveCop = acCapacityW > 0 ? acWeightedCopNumerator / acCapacityW : 3.2;

  // ----- 2. Solar gain through glazing -----
  const shgc = GLAZING_SHGC[f.glazingId] ?? 0.65;
  const solar = ORIENTATION_SOLAR[g.orientation];
  const qSolarW = g.windowAreaM2 * solar.peak * shgc * (c.solarMultiplier ?? 1);

  // ----- 3. Envelope conductance -----
  // Two distinct heat paths with two different driving temperatures:
  //   external walls, glazing and ventilation exchange with OUTDOOR air
  //   internal partitions and the floor/ceiling slabs exchange with the
  //   ADJACENT spaces, which in a real building sit near room temperature
  const grossWall = wallGrossArea(g);
  const netWallArea = Math.max(0, grossWall - g.windowAreaM2);
  const uaWalls = netWallArea * f.wallUValue;
  const uaGlazing = g.windowAreaM2 * f.glazingUValue;
  const uaExternal = uaWalls + uaGlazing;

  const ventConductance = AIR_VOL_HEAT_CAP * f.ach * volumeM3;
  const kExternal = uaExternal + ventConductance;

  const perimeterWallArea = 2 * (g.widthM * g.heightM) + 2 * (g.depthM * g.heightM);
  const internalWallArea = Math.max(0, perimeterWallArea - grossWall);
  const kAdjacent = internalWallArea * INTERNAL_PARTITION_U + 2 * floorAreaM2 * SLAB_U;

  const tAdjacent = f.adjacentSpaceTempC ?? 26;
  const conductanceWPerK = kExternal + kAdjacent;

  // Conductance-weighted mean of the two driving temperatures. Solving with
  // this is exactly equivalent to carrying both paths separately.
  const tEffective = conductanceWPerK > 0
    ? (kExternal * c.outdoorTempC + kAdjacent * tAdjacent) / conductanceWPerK
    : c.outdoorTempC;

  // ----- 4. Solve for indoor temperature -----
  const qInternalW = qEquipmentW + qPeopleW + qSolarW;
  const dTsetpoint = tEffective - c.setpointTempC;

  // Cooling required to hold the setpoint
  const qRequiredAtSetpoint = qInternalW + conductanceWPerK * dTsetpoint;

  let indoorTempC: number;
  let acDeliveredW: number;
  let acUndersized = false;

  if (acCapacityW <= 0) {
    acDeliveredW = 0;
    indoorTempC = conductanceWPerK > 0
      ? tEffective + qInternalW / conductanceWPerK
      : tEffective + 15;
  } else if (qRequiredAtSetpoint <= acCapacityW) {
    acDeliveredW = Math.max(0, qRequiredAtSetpoint);
    indoorTempC = c.setpointTempC;
  } else {
    acUndersized = true;
    acDeliveredW = acCapacityW;
    indoorTempC = tEffective + (qInternalW - acCapacityW) / conductanceWPerK;
  }

  // Recompute each heat path at the actual indoor temperature
  const dTout = c.outdoorTempC - indoorTempC;
  const dTadj = tAdjacent - indoorTempC;
  const qConductionW = uaExternal * dTout + kAdjacent * dTadj;
  const qVentilationW = ventConductance * dTout;
  const qTotalW = qInternalW + qConductionW + qVentilationW;

  // ----- 5. Electrical consequences -----
  const acElectricalW = acDeliveredW / effectiveCop;
  const totalElectricalW = directElectricalW + acElectricalW;

  // The cooling penalty: electricity spent purely removing equipment heat
  const coolingPenaltyW = acCapacityW > 0 ? qEquipmentW / effectiveCop : 0;

  // ----- 6. Comfort -----
  const perceivedTempC = indoorTempC - perceivedCoolingC;
  let comfortStatus: SimulationResult['comfortStatus'];
  if (perceivedTempC < COMFORT_MIN_C - 1) comfortStatus = 'cold';
  else if (perceivedTempC <= COMFORT_MAX_C) comfortStatus = 'comfortable';
  else if (perceivedTempC <= COMFORT_MAX_C + 3) comfortStatus = 'warm';
  else comfortStatus = 'hot';

  // ----- 7. Daily and annual energy -----
  // Each item runs for its own operating hours. The AC runs alongside the
  // longest-running significant load, approximated by occupied hours.
  let dailyKwh = 0;
  let maxOperatingHours = 0;

  for (const item of items) {
    const eq = getEquipment(item.equipmentId);
    if (!eq || eq.coolingCapacityW || eq.category === 'occupant') continue;
    dailyKwh += (eq.watts * eq.dutyCycle * eq.hoursPerDay) / 1000;
    maxOperatingHours = Math.max(maxOperatingHours, eq.hoursPerDay);
  }

  const acHours = Math.min(24, Math.max(maxOperatingHours, occupantCount > 0 ? 10 : 0));
  dailyKwh += (acElectricalW * acHours) / 1000;

  const dailyCo2Kg = dailyKwh * CO2_FACTOR_KG_PER_KWH;
  const annualKwh = dailyKwh * 365;
  const annualCo2Kg = annualKwh * CO2_FACTOR_KG_PER_KWH;

  // ----- 8. Breakdown for the chart -----
  const loadBreakdown: LoadComponent[] = [
    { label: 'Lighting', watts: categoryWatts.lighting ?? 0, color: '#fbbf24' },
    { label: 'Computing & AV', watts: categoryWatts.computing ?? 0, color: '#a78bfa' },
    { label: 'Appliances', watts: categoryWatts.appliance ?? 0, color: '#fb923c' },
    { label: 'Specialist / Lab', watts: categoryWatts.specialist ?? 0, color: '#ef4444' },
    { label: 'Fans', watts: categoryWatts.cooling ?? 0, color: '#60a5fa' },
    { label: 'Air conditioning', watts: acElectricalW, color: '#38bdf8' },
  ].filter(l => l.watts > 0.5);

  return {
    qEquipmentW, qPeopleW, qSolarW, qConductionW, qVentilationW, qTotalW,
    acCapacityW, acDeliveredW, acElectricalW, effectiveCop, acUndersized,
    directElectricalW, totalElectricalW, coolingPenaltyW,
    indoorTempC, perceivedTempC, comfortStatus,
    dailyKwh, dailyCo2Kg, annualKwh, annualCo2Kg,
    floorAreaM2, volumeM3,
    heatDensityWPerM2: floorAreaM2 > 0 ? qTotalW / floorAreaM2 : 0,
    powerDensityWPerM2: floorAreaM2 > 0 ? totalElectricalW / floorAreaM2 : 0,
    euiKwhPerM2Yr: floorAreaM2 > 0 ? annualKwh / floorAreaM2 : 0,
    loadBreakdown, conductanceWPerK, occupantCount,
  };
}

// ---------- Presets ----------

export interface RoomPreset {
  id: string;
  name: string;
  description: string;
  state: RoomState;
}

let uidCounter = 0;
function place(equipmentId: string, gx: number, gz: number): PlacedItem {
  return { uid: `p${uidCounter++}`, equipmentId, gx, gz };
}

function peopleGrid(count: number, cols: number, startX = 1, startZ = 2): PlacedItem[] {
  const out: PlacedItem[] = [];
  for (let i = 0; i < count; i++) {
    out.push(place('person', startX + (i % cols), startZ + Math.floor(i / cols)));
  }
  return out;
}

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'empty',
    name: 'Empty Room',
    description: 'Start from scratch. A bare 6 by 5 metre room.',
    state: {
      geometry: { widthM: 6, depthM: 5, heightM: 3, externalWalls: 2, windowAreaM2: 4, orientation: 'west' },
      fabric: { wallUValue: 1.0, glazingId: 'single', glazingUValue: 5.7, ach: 1.0 },
      conditions: { outdoorTempC: 31, setpointTempC: 24 },
      items: [],
    },
  },
  {
    id: 'office',
    name: 'Small Office',
    description: 'Four desks, tube lighting, one split AC. A typical CityU staff office.',
    state: {
      geometry: { widthM: 6, depthM: 5, heightM: 3, externalWalls: 2, windowAreaM2: 5, orientation: 'west' },
      fabric: { wallUValue: 1.0, glazingId: 'single', glazingUValue: 5.7, ach: 1.0 },
      conditions: { outdoorTempC: 31, setpointTempC: 24 },
      items: [
        place('light_fluorescent_tube', 1, 1), place('light_fluorescent_tube', 3, 1),
        place('light_fluorescent_tube', 1, 3), place('light_fluorescent_tube', 3, 3),
        place('desktop_pc', 0, 2), place('desktop_pc', 2, 2),
        place('desktop_pc', 4, 2), place('laptop', 5, 2),
        place('ac_split_3500', 5, 0),
        place('water_dispenser', 0, 4),
        ...peopleGrid(4, 4, 1, 3),
      ],
    },
  },
  {
    id: 'classroom',
    name: 'Lecture Classroom',
    description: 'Thirty students, projector, overhead lighting. The load is dominated by people.',
    state: {
      geometry: { widthM: 9, depthM: 7, heightM: 3.2, externalWalls: 2, windowAreaM2: 8, orientation: 'west' },
      fabric: { wallUValue: 1.0, glazingId: 'single', glazingUValue: 5.7, ach: 2.0 },
      conditions: { outdoorTempC: 31, setpointTempC: 24 },
      items: [
        ...Array.from({ length: 8 }, (_, i) => place('light_fluorescent_tube', 1 + (i % 4) * 2, 1 + Math.floor(i / 4) * 3)),
        place('projector', 4, 0),
        place('desktop_pc', 0, 0),
        place('ac_split_5000', 8, 0), place('ac_split_5000', 8, 6),
        ...peopleGrid(30, 6, 1, 2),
      ],
    },
  },
  {
    id: 'lab',
    name: 'Research Laboratory',
    description: 'Fume hood, ultra-low freezer, high ventilation. Watch the energy intensity.',
    state: {
      geometry: { widthM: 8, depthM: 6, heightM: 3.2, externalWalls: 2, windowAreaM2: 4, orientation: 'south' },
      fabric: { wallUValue: 1.0, glazingId: 'double', glazingUValue: 2.8, ach: 6.0 },
      conditions: { outdoorTempC: 31, setpointTempC: 22 },
      items: [
        ...Array.from({ length: 6 }, (_, i) => place('light_fluorescent_tube', 1 + (i % 3) * 2, 1 + Math.floor(i / 3) * 3)),
        place('fume_hood', 0, 0), place('fume_hood', 0, 2),
        place('lab_freezer', 7, 0), place('fridge_small', 7, 2),
        place('desktop_pc', 3, 4), place('laptop', 5, 4),
        place('ac_split_5000', 7, 5), place('ac_split_5000', 4, 5),
        ...peopleGrid(4, 4, 2, 3),
      ],
    },
  },
  {
    id: 'server',
    name: 'Small Server Room',
    description: 'Two racks running around the clock. Cooling dominates everything.',
    state: {
      geometry: { widthM: 4, depthM: 4, heightM: 3, externalWalls: 1, windowAreaM2: 0, orientation: 'north' },
      fabric: { wallUValue: 1.0, glazingId: 'single', glazingUValue: 5.7, ach: 0.5 },
      conditions: { outdoorTempC: 31, setpointTempC: 21 },
      items: [
        place('server_rack', 1, 1), place('server_rack', 2, 1),
        place('bulb_led', 1, 0),
        place('ac_split_5000', 3, 3),
      ],
    },
  },
];

// ---------- Comparison helper ----------

export interface ComparisonDelta {
  totalElectricalW: number;
  dailyKwh: number;
  annualCo2Kg: number;
  indoorTempC: number;
}

export function compareResults(a: SimulationResult, b: SimulationResult): ComparisonDelta {
  return {
    totalElectricalW: b.totalElectricalW - a.totalElectricalW,
    dailyKwh: b.dailyKwh - a.dailyKwh,
    annualCo2Kg: b.annualCo2Kg - a.annualCo2Kg,
    indoorTempC: b.indoorTempC - a.indoorTempC,
  };
}

/**
 * Swap every instance of one equipment type for another and report the delta.
 * This powers the "what if these were LEDs" one-click demonstration.
 */
export function swapEquipment(state: RoomState, fromId: string, toId: string): RoomState {
  return {
    ...state,
    items: state.items.map(it => it.equipmentId === fromId ? { ...it, equipmentId: toId } : it),
  };
}

// ============================================================================
// PHASE 2: 24-hour simulation, schedules, and carbon timing
// ============================================================================

/**
 * CLP Hong Kong hourly grid emission factors, kg CO2e/kWh.
 *
 * Lower overnight when Daya Bay nuclear baseload dominates the mix, higher
 * during the afternoon peak when gas peaking plant runs. The 24-hour mean
 * equals the published annual average of 0.34.
 *
 * This matters: a flat annual factor makes load shifting look worthless,
 * which is physically wrong. Only a time-resolved factor reveals the
 * carbon value of moving load.
 */
export const HOURLY_CO2_FACTOR = [
  0.30, 0.29, 0.28, 0.28, 0.29, 0.30, 0.33, 0.36,
  0.38, 0.39, 0.40, 0.39, 0.38, 0.39, 0.40, 0.39,
  0.38, 0.37, 0.35, 0.34, 0.33, 0.32, 0.31, 0.30,
];

/** Outdoor air temperature across the day. Peak at 15:00, trough at 03:00. */
export function outdoorTempAt(hour: number, designPeakC: number): number {
  const mean = designPeakC - 4;
  return mean + 4 * Math.cos((2 * Math.PI * (hour - 15)) / 24);
}

/** Solar gain multiplier 0-1 for a given hour and facade orientation. */
export function solarMultiplierAt(hour: number, orientation: string): number {
  if (hour < 6 || hour > 19) return 0;
  if (orientation === 'north') return 0.35; // diffuse only, roughly flat
  const peakHour: Record<string, number> = { east: 8.5, south: 12, west: 15.5 };
  const width: Record<string, number> = { east: 3.0, south: 4.0, west: 3.0 };
  const p = peakHour[orientation] ?? 12;
  const w = width[orientation] ?? 4;
  return Math.max(0, Math.exp(-(((hour - p) / w) ** 2)));
}

export interface ScheduleEntry {
  /** Hour the item switches on, 0-23 */
  startHour: number;
  /** Hour the item switches off, 1-24 */
  endHour: number;
  /** Runs continuously regardless of start/end */
  alwaysOn: boolean;
}

export type ScheduleMap = Record<string, ScheduleEntry>;

/** Sensible default operating pattern for each equipment type. */
export function defaultScheduleFor(equipmentId: string): ScheduleEntry {
  const alwaysOnIds = ['fridge_small', 'water_dispenser', 'server_rack', 'fume_hood', 'lab_freezer'];
  if (alwaysOnIds.includes(equipmentId)) {
    return { startHour: 0, endHour: 24, alwaysOn: true };
  }
  if (equipmentId === 'kettle') return { startHour: 8, endHour: 9, alwaysOn: false };
  if (equipmentId === 'projector') return { startHour: 9, endHour: 13, alwaysOn: false };
  if (equipmentId === 'person') return { startHour: 9, endHour: 17, alwaysOn: false };
  return { startHour: 8, endHour: 18, alwaysOn: false };
}

export function buildDefaultSchedule(state: RoomState): ScheduleMap {
  const map: ScheduleMap = {};

  // If the room contains equipment that runs continuously and rejects
  // significant heat (servers, freezers, fume hoods), then the cooling has to
  // run continuously too. Defaulting cooling to office hours in that case
  // would leave the room to overheat overnight.
  const continuousHeatIds = ['server_rack', 'lab_freezer', 'fume_hood'];
  const hasContinuousHeat = state.items.some(i => continuousHeatIds.includes(i.equipmentId));

  for (const item of state.items) {
    if (map[item.equipmentId]) continue;
    const eq = getEquipment(item.equipmentId);
    const entry = defaultScheduleFor(item.equipmentId);
    if (hasContinuousHeat && eq?.coolingCapacityW) {
      map[item.equipmentId] = { startHour: 0, endHour: 24, alwaysOn: true };
    } else {
      map[item.equipmentId] = entry;
    }
  }
  return map;
}

export function isActiveAt(entry: ScheduleEntry | undefined, hour: number): boolean {
  if (!entry) return true;
  if (entry.alwaysOn) return true;
  if (entry.startHour <= entry.endHour) {
    return hour >= entry.startHour && hour < entry.endHour;
  }
  // Wraps past midnight
  return hour >= entry.startHour || hour < entry.endHour;
}

export interface HourResult {
  hour: number;
  outdoorTempC: number;
  indoorTempC: number;
  /** Non-AC electrical draw, kW */
  directKw: number;
  /** AC electrical draw, kW */
  acKw: number;
  /** Total electrical draw, kW */
  totalKw: number;
  /** Emissions this hour using the time-varying factor, kg */
  co2Kg: number;
  /** Grid carbon intensity this hour, kg/kWh */
  co2Factor: number;
  /** Per-category electrical draw, kW */
  byCategory: Record<string, number>;
  occupants: number;
  comfortStatus: SimulationResult['comfortStatus'];
}

export interface DayResult {
  hours: HourResult[];
  /** Total electrical energy over 24 hours, kWh */
  dailyKwh: number;
  /** Emissions using hourly factors, kg */
  dailyCo2Kg: number;
  /** Emissions if a flat annual factor were used, kg. Shown for comparison. */
  dailyCo2FlatKg: number;
  /** Highest hourly demand, kW. Drives demand charges in real tariffs. */
  peakKw: number;
  peakHour: number;
  /** Mean demand divided by peak demand. Low values mean peaky, inefficient operation. */
  loadFactor: number;
  annualKwh: number;
  annualCo2Kg: number;
  euiKwhPerM2Yr: number;
  /** Hours spent outside the comfort band */
  uncomfortableHours: number;
  /** Warmest temperature reached during any occupied hour, C */
  maxOccupiedTempC: number;
  /** Carbon saved by moving one hour of peak load to the cleanest hour, kg/day */
  shiftOpportunityKg: number;
  cleanestHour: number;
  dirtiestHour: number;
}

/**
 * Run the room across a full 24-hour day.
 *
 * For each hour we rebuild the item list from the schedule, recompute outdoor
 * temperature and solar gain, and solve the same steady-state heat balance
 * used for the design hour. This is a quasi-steady-state approach: each hour
 * is solved independently with no thermal mass carried between hours.
 */
// ---------------------------------------------------------------------------
// Thermal mass options
//
// Buildings store heat. A room does not jump to a new temperature the instant
// its cooling switches off; it drifts there over hours as the concrete,
// furniture and air release stored energy.
//
// Values are effective thermal capacitance per square metre of floor,
// in kJ/(m2.K), covering air plus the internal surfaces that actively
// exchange heat with the room over a daily cycle. Ranges follow the
// admittance-method categories used in CIBSE Guide A.
// ---------------------------------------------------------------------------

export interface ThermalMassOption { id: string; name: string; kjPerM2K: number; note: string; }

export const THERMAL_MASS_OPTIONS: ThermalMassOption[] = [
  { id: 'light',  name: 'Lightweight', kjPerM2K: 40,  note: 'Plasterboard partitions, raised floor, suspended ceiling' },
  { id: 'medium', name: 'Medium',      kjPerM2K: 80,  note: 'Typical concrete frame with finishes and furniture' },
  { id: 'heavy',  name: 'Heavy',       kjPerM2K: 150, note: 'Exposed concrete soffit and masonry, high stored heat' },
];

export const DEFAULT_THERMAL_MASS_KJ_M2K = 80;

/**
 * Internal gains and conductance for a given set of active items and conditions.
 * Shared by the transient day simulation. Deliberately does NOT solve for
 * temperature, because the transient model steps temperature forward instead.
 */
function gainsAndConductance(
  state: RoomState,
  activeItems: PlacedItem[],
  solarMultiplier: number
) {
  const { geometry: g, fabric: f } = state;
  const floorAreaM2 = g.widthM * g.depthM;
  const volumeM3 = floorAreaM2 * g.heightM;

  let qEquipmentW = 0, qPeopleW = 0, directElectricalW = 0;
  let acCapacityW = 0, acCopNumerator = 0;
  let perceivedCoolingC = 0, occupantCount = 0;
  const categoryWatts: Record<string, number> = {};

  for (const item of activeItems) {
    const eq = getEquipment(item.equipmentId);
    if (!eq) continue;

    if (eq.category === 'occupant') {
      qPeopleW += eq.heatWatts;
      occupantCount += 1;
      continue;
    }
    if (eq.coolingCapacityW) {
      acCapacityW += eq.coolingCapacityW;
      acCopNumerator += eq.coolingCapacityW * (eq.cop ?? 3.2);
      continue;
    }
    const designW = eq.watts * eq.dutyCycle;
    directElectricalW += designW;
    qEquipmentW += eq.heatWatts * eq.dutyCycle;
    categoryWatts[eq.category] = (categoryWatts[eq.category] ?? 0) + designW;
    if (eq.perceivedCoolingC) perceivedCoolingC = Math.max(perceivedCoolingC, eq.perceivedCoolingC);
  }

  const effectiveCop = acCapacityW > 0 ? acCopNumerator / acCapacityW : 3.2;

  const shgc = GLAZING_SHGC[f.glazingId] ?? 0.65;
  const qSolarW = g.windowAreaM2 * ORIENTATION_SOLAR[g.orientation].peak * shgc * solarMultiplier;

  const areas = [g.widthM * g.heightM, g.depthM * g.heightM, g.widthM * g.heightM, g.depthM * g.heightM];
  const grossWall = areas.slice(0, g.externalWalls).reduce((a, b) => a + b, 0);
  const uaExternal = Math.max(0, grossWall - g.windowAreaM2) * f.wallUValue + g.windowAreaM2 * f.glazingUValue;
  const ventConductance = AIR_VOL_HEAT_CAP * f.ach * volumeM3;
  const kExternal = uaExternal + ventConductance;

  const perimeterWallArea = 2 * (g.widthM * g.heightM) + 2 * (g.depthM * g.heightM);
  const internalWallArea = Math.max(0, perimeterWallArea - grossWall);
  const kAdjacent = internalWallArea * INTERNAL_PARTITION_U + 2 * floorAreaM2 * SLAB_U;

  return {
    qEquipmentW, qPeopleW, qSolarW, directElectricalW,
    acCapacityW, effectiveCop, perceivedCoolingC, occupantCount,
    categoryWatts,
    kExternal, kAdjacent,
    conductanceWPerK: kExternal + kAdjacent,
    floorAreaM2,
  };
}

const CATEGORY_DISPLAY: Record<string, string> = {
  lighting: 'Lighting',
  computing: 'Computing & AV',
  appliance: 'Appliances',
  specialist: 'Specialist / Lab',
  cooling: 'Fans',
};

/**
 * Run the room across a full 24-hour day as a TRANSIENT simulation.
 *
 * Unlike the design-hour calculation, which solves the steady-state balance
 * for a sustained peak condition, this steps temperature forward hour by hour:
 *
 *   C * dT/dt = Q_gain - Q_ac
 *   T(h+1) = T(h) + (Q_gain - Q_ac) * 3600 / C
 *
 * where C is the room's effective thermal capacitance in J/K. This is why
 * switching the cooling off does not cause an instant temperature jump: the
 * stored heat in the structure has to be released first.
 *
 * The AC controller each hour aims to hold the setpoint, requesting enough
 * cooling to cancel the gains plus pull any existing offset back down over
 * roughly one hour, limited by installed capacity.
 *
 * The day is run three times, carrying the final temperature into the next
 * pass, so the profile settles into a repeating daily cycle rather than
 * depending on an arbitrary starting temperature.
 *
 * Note: the design-hour view deliberately remains steady-state. Sizing
 * equipment for a sustained peak and simulating daily operation are two
 * different engineering questions and use two different models.
 */
export function simulateDay(state: RoomState, schedule: ScheduleMap): DayResult {
  const floorArea = state.geometry.widthM * state.geometry.depthM;
  const massKjPerM2K = state.fabric.thermalMassKjPerM2K ?? DEFAULT_THERMAL_MASS_KJ_M2K;
  const capacitanceJPerK = Math.max(1, massKjPerM2K * 1000 * floorArea);
  const tAdjacent = state.fabric.adjacentSpaceTempC ?? 26;

  // Precompute the active item list and gains for each hour, they do not
  // depend on indoor temperature.
  const perHour = Array.from({ length: 24 }, (_, h) => {
    const activeItems = state.items.filter(it => isActiveAt(schedule[it.equipmentId], h));
    return {
      hour: h,
      outdoorTempC: outdoorTempAt(h, state.conditions.outdoorTempC),
      g: gainsAndConductance(state, activeItems, solarMultiplierAt(h, state.geometry.orientation)),
    };
  });

  let T = state.conditions.setpointTempC;
  let hours: HourResult[] = [];

  for (let pass = 0; pass < 3; pass++) {
    hours = [];
    for (const slot of perHour) {
      const { g, outdoorTempC } = slot;

      const qInternalW = g.qEquipmentW + g.qPeopleW + g.qSolarW;
      // External paths driven by outdoor air, adjacent paths by neighbouring spaces
      const qEnvelopeW =
        g.kExternal * (outdoorTempC - T) + g.kAdjacent * (tAdjacent - T);
      const qGainW = qInternalW + qEnvelopeW;

      // Controller: cancel the gains, plus recover any drift above setpoint
      // over about one hour, subject to installed capacity.
      let qAcW = 0;
      if (g.acCapacityW > 0) {
        const pullDownW = (capacitanceJPerK * (T - state.conditions.setpointTempC)) / 3600;
        qAcW = Math.min(g.acCapacityW, Math.max(0, qGainW + pullDownW));
      }

      const qNetW = qGainW - qAcW;
      let tNext = T + (qNetW * 3600) / capacitanceJPerK;
      tNext = Math.max(5, Math.min(55, tNext));

      // Report the mid-hour temperature, which represents the hour better
      // than either endpoint.
      const tMid = (T + tNext) / 2;

      const acElectricalW = qAcW / g.effectiveCop;
      const totalKw = (g.directElectricalW + acElectricalW) / 1000;
      const factor = HOURLY_CO2_FACTOR[slot.hour];

      const byCategory: Record<string, number> = {};
      for (const [cat, w] of Object.entries(g.categoryWatts)) {
        if (w > 0.5) byCategory[CATEGORY_DISPLAY[cat] ?? cat] = w / 1000;
      }
      if (acElectricalW > 0.5) byCategory['Air conditioning'] = acElectricalW / 1000;

      const perceived = tMid - g.perceivedCoolingC;
      let comfortStatus: SimulationResult['comfortStatus'];
      if (perceived < COMFORT_MIN_C - 1) comfortStatus = 'cold';
      else if (perceived <= COMFORT_MAX_C) comfortStatus = 'comfortable';
      else if (perceived <= COMFORT_MAX_C + 3) comfortStatus = 'warm';
      else comfortStatus = 'hot';

      hours.push({
        hour: slot.hour,
        outdoorTempC: Math.round(outdoorTempC * 10) / 10,
        indoorTempC: Math.round(tMid * 10) / 10,
        directKw: g.directElectricalW / 1000,
        acKw: acElectricalW / 1000,
        totalKw,
        co2Kg: totalKw * factor,
        co2Factor: factor,
        byCategory,
        occupants: g.occupantCount,
        comfortStatus,
      });

      T = tNext;
    }
  }

  const dailyKwh = hours.reduce((s, x) => s + x.totalKw, 0);
  const dailyCo2Kg = hours.reduce((s, x) => s + x.co2Kg, 0);
  const dailyCo2FlatKg = dailyKwh * CO2_FACTOR_KG_PER_KWH;

  let peakKw = 0, peakHour = 0;
  for (const x of hours) if (x.totalKw > peakKw) { peakKw = x.totalKw; peakHour = x.hour; }
  const loadFactor = peakKw > 0 ? (dailyKwh / 24) / peakKw : 0;

  const uncomfortableHours = hours.filter(x => x.comfortStatus !== 'comfortable' && x.occupants > 0).length;
  const maxOccupiedTempC = hours.reduce((m, x) => x.occupants > 0 ? Math.max(m, x.indoorTempC) : m, -Infinity);

  let cleanestHour = 0, dirtiestHour = 0;
  HOURLY_CO2_FACTOR.forEach((f, i) => {
    if (f < HOURLY_CO2_FACTOR[cleanestHour]) cleanestHour = i;
    if (f > HOURLY_CO2_FACTOR[dirtiestHour]) dirtiestHour = i;
  });
  const shiftOpportunityKg = peakKw * (HOURLY_CO2_FACTOR[peakHour] - HOURLY_CO2_FACTOR[cleanestHour]);

  const annualKwh = dailyKwh * 365;

  return {
    hours, dailyKwh, dailyCo2Kg, dailyCo2FlatKg,
    peakKw, peakHour, loadFactor,
    annualKwh,
    annualCo2Kg: annualKwh * CO2_FACTOR_KG_PER_KWH,
    euiKwhPerM2Yr: floorArea > 0 ? annualKwh / floorArea : 0,
    uncomfortableHours,
    maxOccupiedTempC: Number.isFinite(maxOccupiedTempC) ? maxOccupiedTempC : 0,
    shiftOpportunityKg, cleanestHour, dirtiestHour,
  };
}

// ============================================================================
// PHASE 3: Capital costs, challenges, and comparison
// ============================================================================

/**
 * Indicative installed capital cost per unit, USD.
 * Order-of-magnitude figures for teaching the cost/benefit trade-off,
 * not procurement quotes.
 */
export const EQUIPMENT_COST_USD: Record<string, number> = {
  bulb_incandescent: 2,
  bulb_cfl: 5,
  bulb_led: 9,
  light_fluorescent_tube: 18,
  fan_ceiling: 130,
  ac_split_2500: 650,
  ac_split_3500: 850,
  ac_split_5000: 1250,
  ac_inverter_3500: 1150,
  desktop_pc: 850,
  laptop: 1000,
  projector: 650,
  server_rack: 8000,
  fridge_small: 320,
  kettle: 45,
  water_dispenser: 420,
  fume_hood: 12000,
  lab_freezer: 10000,
  person: 0,
};

export function costOf(equipmentId: string): number {
  return EQUIPMENT_COST_USD[equipmentId] ?? 0;
}

function countByType(items: PlacedItem[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const i of items) c[i.equipmentId] = (c[i.equipmentId] ?? 0) + 1;
  return c;
}

/**
 * Capital spent moving from a starting configuration to the current one.
 *
 * Only additions cost money. Removing existing equipment neither costs nor
 * refunds, which mirrors reality: you do not recover capital by ripping out
 * old light fittings.
 */
export function computeSpend(startItems: PlacedItem[], currentItems: PlacedItem[]): number {
  const start = countByType(startItems);
  const now = countByType(currentItems);
  let spend = 0;
  for (const [id, n] of Object.entries(now)) {
    const added = n - (start[id] ?? 0);
    if (added > 0) spend += added * costOf(id);
  }
  return spend;
}

export interface ObjectiveContext {
  day: DayResult;
  design: SimulationResult;
  state: RoomState;
  startState: RoomState;
  spend: number;
}

export interface ChallengeObjective {
  id: string;
  label: string;
  /** Passes when true */
  check: (ctx: ObjectiveContext) => boolean;
  /** Live readout of where the player currently stands */
  status: (ctx: ObjectiveContext) => string;
}

export interface Challenge {
  id: string;
  title: string;
  brief: string;
  /** Why this scenario matters in the real world */
  realWorldNote: string;
  budgetUsd: number;
  startState: RoomState;
  objectives: ChallengeObjective[];
}

function countOf(state: RoomState, id: string): number {
  return state.items.filter(i => i.equipmentId === id).length;
}

function makeStart(presetId: string, mutate: (s: RoomState) => void): RoomState {
  const base = ROOM_PRESETS.find(p => p.id === presetId)!;
  const s = JSON.parse(JSON.stringify(base.state)) as RoomState;
  mutate(s);
  return s;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'cool_classroom',
    title: 'Cool the Classroom',
    brief:
      'Thirty students, an old fixed-speed air conditioner and incandescent lighting. ' +
      'The room overheats during afternoon classes. Bring it back into the comfort band ' +
      'without blowing the budget or the peak demand limit.',
    realWorldNote:
      'Overheating teaching spaces are one of the most common complaints estates teams receive. ' +
      'The instinctive fix is a bigger chiller, which is usually the most expensive answer.',
    budgetUsd: 3000,
    startState: makeStart('classroom', s => {
      // Strip the AC back to a single undersized unit and swap tubes for incandescent
      s.items = s.items.filter(i => i.equipmentId !== 'ac_split_5000');
      s.items.push({ uid: 'ch_ac1', equipmentId: 'ac_split_2500', gx: 8, gz: 0 });
      s.items = s.items.map(i =>
        i.equipmentId === 'light_fluorescent_tube' ? { ...i, equipmentId: 'bulb_incandescent' } : i
      );
    }),
    objectives: [
      {
        id: 'comfort',
        label: 'Occupied hours stay at or below 26 C',
        check: c => c.day.maxOccupiedTempC <= 26.05,
        status: c => `warmest occupied hour: ${c.day.maxOccupiedTempC.toFixed(1)} C`,
      },
      {
        id: 'peak',
        label: 'Peak demand below 4.0 kW',
        check: c => c.day.peakKw < 4.0,
        status: c => `peak: ${c.day.peakKw.toFixed(2)} kW`,
      },
      {
        id: 'students',
        label: 'All 30 students still seated',
        check: c => countOf(c.state, 'person') >= 30,
        status: c => `${countOf(c.state, 'person')} of 30 present`,
      },
      {
        id: 'budget',
        label: 'Stay within the capital budget',
        check: c => c.spend <= 3000,
        status: c => `spent $${c.spend.toLocaleString()} of $3,000`,
      },
    ],
  },
  {
    id: 'efficient_office',
    title: 'The Efficient Office',
    brief:
      'A four-person office running at well above the portfolio median energy intensity. ' +
      'Get its annual EUI under 150 kWh/m2/yr while keeping all four people working ' +
      'and the room comfortable.',
    realWorldNote:
      'EUI is the metric estates teams are benchmarked on. Getting below the peer median ' +
      'is what moves a building off the retrofit priority list.',
    budgetUsd: 4000,
    startState: makeStart('office', s => {
      s.items = s.items.map(i =>
        i.equipmentId === 'light_fluorescent_tube' ? { ...i, equipmentId: 'bulb_incandescent' } : i
      );
    }),
    objectives: [
      {
        id: 'eui',
        label: 'Annual EUI at or below 150 kWh/m2/yr',
        check: c => c.day.euiKwhPerM2Yr <= 150,
        status: c => `current EUI: ${c.day.euiKwhPerM2Yr.toFixed(0)} kWh/m2/yr`,
      },
      {
        id: 'workstations',
        label: 'Four workstations retained',
        check: c => countOf(c.state, 'desktop_pc') + countOf(c.state, 'laptop') >= 4,
        status: c => `${countOf(c.state, 'desktop_pc') + countOf(c.state, 'laptop')} workstations`,
      },
      {
        id: 'comfort',
        label: 'No uncomfortable occupied hours',
        check: c => c.day.uncomfortableHours === 0,
        status: c => `${c.day.uncomfortableHours} uncomfortable hours`,
      },
      {
        id: 'budget',
        label: 'Stay within the capital budget',
        check: c => c.spend <= 4000,
        status: c => `spent $${c.spend.toLocaleString()} of $4,000`,
      },
    ],
  },
  {
    id: 'lab_diet',
    title: 'Lab on a Diet',
    brief:
      'Laboratories are the highest-intensity spaces on any campus. Cut this one\u2019s ' +
      'energy intensity by 15 percent without removing the fume hood or the freezer, ' +
      'both of which are required for the research to continue.',
    realWorldNote:
      'This is the hardest real case. The largest loads are non-negotiable safety and ' +
      'research equipment, so savings have to come from everything around them.',
    budgetUsd: 5000,
    startState: makeStart('lab', s => {
      s.items = s.items.map(i =>
        i.equipmentId === 'light_fluorescent_tube' ? { ...i, equipmentId: 'bulb_incandescent' } : i
      );
    }),
    objectives: [
      {
        id: 'reduction',
        label: 'Cut annual EUI by at least 15 percent',
        check: c => {
          const base = simulateDay(c.startState, buildDefaultSchedule(c.startState));
          return c.day.euiKwhPerM2Yr <= base.euiKwhPerM2Yr * 0.85;
        },
        status: c => {
          const base = simulateDay(c.startState, buildDefaultSchedule(c.startState));
          const cut = (1 - c.day.euiKwhPerM2Yr / base.euiKwhPerM2Yr) * 100;
          return `${cut.toFixed(1)} percent reduction so far`;
        },
      },
      {
        id: 'safety',
        label: 'Fume hood and freezer both retained',
        check: c => countOf(c.state, 'fume_hood') >= 2 && countOf(c.state, 'lab_freezer') >= 1,
        status: c => `${countOf(c.state, 'fume_hood')} fume hoods, ${countOf(c.state, 'lab_freezer')} freezer`,
      },
      {
        id: 'budget',
        label: 'Stay within the capital budget',
        check: c => c.spend <= 5000,
        status: c => `spent $${c.spend.toLocaleString()} of $5,000`,
      },
    ],
  },
  {
    id: 'carbon_timing',
    title: 'The Carbon Shift',
    brief:
      'This server room runs flat out around the clock. You cannot switch the racks off, ' +
      'but you can change everything else. Get daily emissions below 32 kg CO2 while ' +
      'keeping both racks running and the room at or below 24 C.',
    realWorldNote:
      'Continuous loads are where efficiency compounds hardest, because every watt saved ' +
      'is saved 8,760 hours a year and drags the cooling load down with it. Try raising the ' +
      'setpoint first: you will find it barely helps, because this room is dominated by ' +
      'internal equipment heat rather than heat coming in from outside. That is the lesson.',
    budgetUsd: 6000,
    startState: makeStart('server', s => {
      s.items = s.items.filter(i => i.equipmentId !== 'ac_split_5000');
      s.items.push({ uid: 'ch_sac', equipmentId: 'ac_split_5000', gx: 3, gz: 3 });
      s.items.push({ uid: 'ch_sb1', equipmentId: 'bulb_incandescent', gx: 0, gz: 3 });
    }),
    objectives: [
      {
        id: 'co2',
        label: 'Daily emissions below 32 kg CO2',
        check: c => c.day.dailyCo2Kg < 32,
        status: c => `current: ${c.day.dailyCo2Kg.toFixed(1)} kg CO2 per day`,
      },
      {
        id: 'racks',
        label: 'Both server racks still running',
        check: c => countOf(c.state, 'server_rack') >= 2,
        status: c => `${countOf(c.state, 'server_rack')} of 2 racks`,
      },
      {
        id: 'temp',
        label: 'Room held at or below 24 C all day',
        check: c => Math.max(...c.day.hours.map(h => h.indoorTempC)) <= 24.05,
        status: c => `warmest hour: ${Math.max(...c.day.hours.map(h => h.indoorTempC)).toFixed(1)} C`,
      },
      {
        id: 'budget',
        label: 'Stay within the capital budget',
        check: c => c.spend <= 6000,
        status: c => `spent $${c.spend.toLocaleString()} of $6,000`,
      },
    ],
  },
];

/** Evaluate every objective in a challenge against the current room. */
export function evaluateChallenge(challenge: Challenge, state: RoomState, schedule: ScheduleMap) {
  const day = simulateDay(state, schedule);
  const design = simulateRoom(state);
  const spend = computeSpend(challenge.startState.items, state.items);
  const ctx: ObjectiveContext = { day, design, state, startState: challenge.startState, spend };

  const results = challenge.objectives.map(o => ({
    id: o.id,
    label: o.label,
    passed: o.check(ctx),
    status: o.status(ctx),
  }));

  return {
    day, design, spend,
    results,
    allPassed: results.every(r => r.passed),
    passedCount: results.filter(r => r.passed).length,
  };
}
