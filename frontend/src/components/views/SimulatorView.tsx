'use client';
import { useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import WhatIfSimulator from '@/components/WhatIfSimulator';
import FloorPlanHeatMap from '@/components/FloorPlanHeatMap';
import GHGScopeBreakdown from '@/components/GHGScopeBreakdown';

export default function SimulatorView() {
  const { building, loadDashboard, loading } = useDashboardStore();
  useEffect(() => { if (!building) loadDashboard(); }, [building, loadDashboard]);

  if (loading || !building) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Scenario Simulator</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Model what-if scenarios and explore building energy zones
        </p>
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <WhatIfSimulator />
          <FloorPlanHeatMap building={building} />
        </div>
        <GHGScopeBreakdown />
      </div>
    </div>
  );
}
