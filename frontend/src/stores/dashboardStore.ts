'use client';
import { create } from 'zustand';
import { api, Building, DailyConsumption, HourlyConsumption, YearlyData, ResilienceResult, AlertData } from '@/lib/api';

interface DashboardState {
  building: Building | null;
  dailyData: DailyConsumption[];
  hourlyData: HourlyConsumption[];
  historicalData: YearlyData[];
  resilience: ResilienceResult | null;
  alerts: AlertData[];
  selectedDate: string;
  loading: boolean;
  error: string | null;

  loadDashboard: () => Promise<void>;
  loadHourlyData: (date: string) => Promise<void>;
  simulateScenario: (adjustments: any) => Promise<ResilienceResult | null>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  building: null,
  dailyData: [],
  hourlyData: [],
  historicalData: [],
  resilience: null,
  alerts: [],
  selectedDate: '2024-03-15',
  loading: true,
  error: null,

  loadDashboard: async () => {
    try {
      set({ loading: true, error: null });

      const buildings = await api.getBuildings();
      if (buildings.length === 0) throw new Error('No buildings found');
      const building = buildings[0];

      const [dailyData, historicalData, resilience, alerts, hourlyData] = await Promise.all([
        api.getDailyConsumption(building._id, 900),
        api.getHistoricalData(),
        api.getResilienceCurrent(building._id),
        api.getAlerts(building._id).catch(() => []),
        api.getHourlyConsumption(building._id, '2024-03-15'),
      ]);

      set({ building, dailyData, historicalData, resilience, alerts, hourlyData, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadHourlyData: async (date: string) => {
    const { building } = get();
    if (!building) return;
    const hourlyData = await api.getHourlyConsumption(building._id, date);
    set({ hourlyData, selectedDate: date });
  },

  simulateScenario: async (adjustments: any) => {
    const { building } = get();
    if (!building) return null;
    const result = await api.simulateScenario(building._id, adjustments);
    return result;
  },
}));
