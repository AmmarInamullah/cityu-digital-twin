'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load pages for code splitting
const DashboardView = dynamic(() => import('@/components/views/DashboardView'), { ssr: false });
const ForecastView = dynamic(() => import('@/components/views/ForecastView'), { ssr: false });
const AlertsView = dynamic(() => import('@/components/views/AlertsView'), { ssr: false });
const SimulatorView = dynamic(() => import('@/components/views/SimulatorView'), { ssr: false });
const GameView = dynamic(() => import('@/components/views/GameView'), { ssr: false });
const AnalyticsView = dynamic(() => import('@/components/views/AnalyticsView'), { ssr: false });
const MethodologyView = dynamic(() => import('@/components/views/MethodologyView'), { ssr: false });
const RoomSimulatorView = dynamic(() => import('@/components/views/RoomSimulatorView'), { ssr: false });

type View = 'dashboard' | 'forecast' | 'alerts' | 'simulator' | 'game' | 'analytics' | 'methodology' | 'room';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◐' },
  { id: 'analytics', label: 'Analytics', icon: '◧' },
  { id: 'forecast', label: 'Forecasting', icon: '◈' },
  { id: 'alerts', label: 'Alerts', icon: '◉' },
  { id: 'room', label: 'Room Simulator', icon: '◱' },
  { id: 'simulator', label: 'Scenario Tools', icon: '◎' },
  { id: 'game', label: 'Game Mode', icon: '◆' },
  { id: 'methodology', label: 'Methodology', icon: '◇' },
];

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col border-r transition-all duration-300"
        style={{
          width: sidebarCollapsed ? 60 : 220,
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* Logo */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'var(--accent-teal)', color: '#0a0f1a' }}>
              DT
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">CityU Resilience</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Digital Twin</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
              style={{
                background: activeView === item.id ? 'var(--accent-teal)' : 'transparent',
                color: activeView === item.id ? '#0a0f1a' : 'var(--text-secondary)',
              }}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Status footer */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>System Online</span>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="text-[9px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
              YEUNG Building
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 text-center text-xs border-t"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          {sidebarCollapsed ? '▸' : '◂'}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary key={activeView}>
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'forecast' && <ForecastView />}
          {activeView === 'alerts' && <AlertsView />}
          {activeView === 'simulator' && <SimulatorView />}
          {activeView === 'room' && <RoomSimulatorView />}
          {activeView === 'game' && <GameView />}
          {activeView === 'methodology' && <MethodologyView />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
