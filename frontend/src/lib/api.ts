const API_BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export interface Building {
  _id: string;
  name: string;
  location: string;
  baselineDailyKwh: number;
  zoneBreakdown: {
    generalLightingAC: number;
    laboratoryPower: number;
    chillerPlant: number;
    otherBuildingServices: number;
  };
}

export interface DailyConsumption {
  date: string;
  totalKwh: number;
  co2Kg: number;
}

export interface HourlyConsumption {
  hour: number;
  kwh: number;
}

export interface YearlyData {
  year: string;
  yeungKwh: number;
  campusTotalKwh: number;
  ghgPerFloorArea: number | null;
}

export interface ResilienceResult {
  score: number;
  breakdown: {
    energyPerformance: number;
    co2Trajectory: number;
    operationalAdaptability: number;
  };
  metadata: {
    dailyKwh: number;
    dailyCo2Kg: number;
    anomalyCount: number;
    baselineDeviation: number;
  };
}

export interface AlertData {
  _id: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  resolved: boolean;
}

export interface AlertStats {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
}

export interface BuildingConfig {
  gridEmissionFactor: number;
  gridProvider: string;
  baselineDailyKwh: number;
  baselineGhgPerFloorArea: number;
  targetGhgPerFloorArea2030: number;
  resilienceWeights: {
    energyPerformance: number;
    co2Trajectory: number;
    operationalAdaptability: number;
  };
}

export const api = {
  getBuildings: () => fetchJSON<Building[]>('/buildings'),
  getBuilding: (id: string) => fetchJSON<Building>(`/buildings/${id}`),
  getHistoricalData: () => fetchJSON<YearlyData[]>('/buildings/historical-data'),
  getGHGScopes: () => fetchJSON<any>('/buildings/ghg-scopes'),
  getConfig: () => fetchJSON<BuildingConfig>('/buildings/config'),

  getDailyConsumption: (buildingId: string, days = 900) =>
    fetchJSON<DailyConsumption[]>(`/readings/${buildingId}/daily?days=${days}`),
  getHourlyConsumption: (buildingId: string, date: string) =>
    fetchJSON<HourlyConsumption[]>(`/readings/${buildingId}/hourly?date=${date}`),
  getZoneBreakdown: (buildingId: string) =>
    fetchJSON<any[]>(`/readings/${buildingId}/zones`),

  getResilienceCurrent: (buildingId: string) =>
    fetchJSON<ResilienceResult>(`/resilience/${buildingId}/current`),
  simulateScenario: async (buildingId: string, adjustments: any): Promise<ResilienceResult> => {
    const res = await fetch(`${API_BASE}/resilience/${buildingId}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustments }),
    });
    const json = await res.json();
    return json.data;
  },

  getAlerts: (buildingId: string) =>
    fetchJSON<AlertData[]>(`/alerts/${buildingId}?limit=20`),
  getAlertStats: (buildingId: string) =>
    fetchJSON<AlertStats>(`/alerts/${buildingId}/stats`),
};
