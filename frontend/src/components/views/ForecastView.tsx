'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface ForecastPrediction {
  timestamp: string;
  predictedKwh: number;
}

interface ForecastMetrics {
  mae: number;
  rmse: number;
  modelType: string;
  featureCount: number;
  trainPeriod: { from: string; to: string };
  testPeriod: { from: string; to: string };
}

interface AlertStats {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
}

interface ForecastData {
  predictions: ForecastPrediction[];
  metrics: ForecastMetrics;
  generatedAt: string;
}

export default function ForecastView() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [hourlyActual, setHourlyActual] = useState<Array<{ hour: number; kwh: number }>>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [totalReadings, setTotalReadings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const bRes = await fetch('/api/buildings');
        const buildings = await bRes.json();
        const buildingId = buildings.data?.[0]?._id;

        if (!buildingId) {
          setError('No building data found. Seed the database first.');
          setLoading(false);
          return;
        }

        const parallelFetches: Promise<Response>[] = [
          fetch(`/api/alerts/${buildingId}/stats`),
          fetch('/api/buildings'),
        ];

        if (buildingId) {
          parallelFetches.push(
            fetch(`/api/readings/${buildingId}/hourly?date=2024-06-15`),
            fetch(`/api/readings/${buildingId}?metricType=energy_kwh&limit=10000`)
          );
        }

        const [statsRes, , hourlyRes, readingsRes] = await Promise.all(parallelFetches);

        const statsData = await statsRes.json();
        setAlertStats(statsData.data || null);

        if (hourlyRes) {
          const hrData = await hourlyRes.json();
          setHourlyActual(hrData.data || []);
        }

        if (readingsRes) {
          const readingsData = await readingsRes.json();
          setTotalReadings(readingsData.count || 0);
        }

        try {
          const fRes = await fetch('/api/analysis/full');
          const fJson = await fRes.json();
          if (fJson.success && fJson.data?.forecast) {
            setForecast(fJson.data.forecast);
          }
        } catch {
          // No forecast available yet
        }
      } catch (err) {
        setError('Failed to load data. Is the backend running?');
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading forecast data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-xl p-6 max-w-md text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--accent-red)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const hasForecast = forecast && forecast.predictions.length > 0;
  const detectionRate = totalReadings > 0
    ? ((alertStats?.total || 0) / totalReadings * 100).toFixed(1)
    : '—';

  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Energy Forecasting</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {hasForecast
            ? 'ML-powered consumption prediction and anomaly detection'
            : 'Anomaly detection and ML pipeline status'}
        </p>
      </div>

      <div className="p-8">
        {hasForecast ? (
          <ForecastContent forecast={forecast} hourlyActual={hourlyActual} alertStats={alertStats} totalReadings={totalReadings} />
        ) : (
          <NotYetGenerated alertStats={alertStats} totalReadings={totalReadings} detectionRate={detectionRate} />
        )}
      </div>
    </div>
  );
}

function NotYetGenerated({ alertStats, totalReadings, detectionRate }: {
  alertStats: AlertStats | null;
  totalReadings: number;
  detectionRate: string;
}) {
  return (
    <div>
      {/* Alert stats are real — show them */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Readings</div>
          <div className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--text-primary)' }}>{totalReadings.toLocaleString()}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>energy_kwh records</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Threshold Alerts</div>
          <div className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--accent-red)' }}>{alertStats?.total || 0}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{alertStats?.unresolved || 0} unresolved</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Detection Rate</div>
          <div className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--accent-teal)' }}>{detectionRate}%</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>of all readings</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ML Model</div>
          <div className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--accent-amber)' }}>Pending</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>not yet trained</div>
        </div>
      </div>

      {/* ML pipeline not yet run */}
      <div className="rounded-xl p-8 mb-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-3xl mb-4">🔬</div>
        <h3 className="text-lg font-semibold mb-2">ML Forecasting Pipeline Not Yet Generated</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          The energy forecasting model has not been trained yet. The pipeline uses scikit-learn LinearRegression
          with calendar-based features (hour, day-of-week, month) to predict next-day hourly consumption.
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Currently, anomaly detection uses a <strong>threshold-based</strong> approach: readings exceeding 1.5x the expected
          hourly average are flagged. The ML pipeline will upgrade this to z-score residual analysis on forecast predictions.
        </p>
        <div className="rounded-lg p-4 text-left" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>To generate forecasts, run:</div>
          <div className="font-mono text-xs space-y-1">
            <div style={{ color: 'var(--text-muted)' }}>cd ml</div>
            <div style={{ color: 'var(--accent-teal)' }}>pip install -r requirements.txt</div>
            <div style={{ color: 'var(--accent-teal)' }}>python forecast.py</div>
          </div>
        </div>
      </div>

      {/* What the ML pipeline will produce */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Planned: Feature Engineering</div>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {[
              { feat: 'Hour of day (0-23)', desc: 'One-hot encoded, 24 features' },
              { feat: 'Day of week (1-7)', desc: 'One-hot encoded, 7 features' },
              { feat: 'Month (1-12)', desc: 'One-hot encoded, 12 features' },
              { feat: 'Is weekend', desc: 'Binary flag (Sat/Sun)' },
            ].map(f => (
              <div key={f.feat} className="flex justify-between rounded-lg p-2" style={{ background: 'var(--bg-primary)' }}>
                <span className="font-medium">{f.feat}</span>
                <span style={{ color: 'var(--text-muted)' }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Planned: Evaluation Methodology</div>
          <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <p>Time-based 80/20 split: train on Jul 2023 to Apr 2024, test on Apr to Jun 2024. Random shuffle is never used for time series as it leaks future data into training.</p>
            <p>Target MAE: below 15% of mean hourly consumption. Current threshold-based detection flags 1.5x hourly average.</p>
            <p className="font-medium" style={{ color: 'var(--accent-teal)' }}>Next improvement: add weather data (OpenWeatherMap) as an additional feature to capture temperature-driven HVAC load.</p>
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Current: Anomaly Detection</div>
          <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <p><strong>Method:</strong> Threshold-based. Flags readings exceeding 1.5x the expected hourly average (baseline_daily / 24).</p>
            <p><strong>Severity levels:</strong> Low (&gt;1.5x), Medium (&gt;1.75x), High (&gt;2.0x)</p>
            <p><strong>Limitation:</strong> Cannot detect gradual drift, seasonal anomalies, or zone-specific faults. The ML pipeline will use z-score residuals (threshold: 2.5σ) for more sophisticated detection.</p>
            <p className="font-medium" style={{ color: 'var(--accent-amber)' }}>Note: alerts shown here are from the threshold detector, not from ML. This is stated transparently.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForecastContent({ forecast, hourlyActual, alertStats, totalReadings }: {
  forecast: ForecastData;
  hourlyActual: Array<{ hour: number; kwh: number }>;
  alertStats: AlertStats | null;
  totalReadings: number;
}) {
  const metrics = forecast.metrics;
  const predictions = forecast.predictions || [];
  const forecastChartData = predictions.map(p => ({
    hour: new Date(p.timestamp).getUTCHours(),
    predicted: Math.round(p.predictedKwh),
  }));

  const overlayData = forecastChartData.map(f => {
    const actual = hourlyActual.find(h => h.hour === f.hour);
    return { ...f, actual: actual?.kwh || null };
  });

  const detectionRate = totalReadings > 0
    ? ((alertStats?.total || 0) / totalReadings * 100).toFixed(1)
    : '—';

  return (
    <div>
      <div className="rounded-xl p-3 mb-6 text-xs" style={{ background: 'var(--accent-blue-dim)', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)' }}>
        Generated at: {new Date(forecast.generatedAt).toLocaleString()} · Model: {metrics.modelType} · Train: {metrics.trainPeriod.from} to {metrics.trainPeriod.to} · Test: {metrics.testPeriod.from} to {metrics.testPeriod.to}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Model', value: metrics.modelType, sub: 'scikit-learn', color: 'var(--accent-blue)' },
          { label: 'Test MAE', value: `${metrics.mae}`, sub: 'kWh', color: 'var(--accent-teal)' },
          { label: 'Test RMSE', value: `${metrics.rmse}`, sub: 'kWh', color: 'var(--accent-amber)' },
          { label: 'Features', value: `${metrics.featureCount}`, sub: 'hour + dow + month', color: 'var(--accent-blue)' },
          { label: 'Detection Rate', value: detectionRate, sub: '% of readings', color: 'var(--accent-teal)' },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
            <div className="text-lg font-bold font-mono mt-1" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>24-Hour Ahead Forecast</div>
          <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Next-day prediction from trained model</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={forecastChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString()} kWh`, 'Predicted']} labelFormatter={(h) => `${h}:00`} />
              <Bar dataKey="predicted" radius={[3, 3, 0, 0]} maxBarSize={20}>
                {forecastChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.predicted > 7000 ? 'var(--accent-amber)' : 'var(--accent-teal)'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Actual vs Predicted</div>
          <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Forecast overlay on real hourly consumption</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={overlayData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(h) => `${h}:00`} />
              <Line type="monotone" dataKey="actual" stroke="var(--accent-blue)" strokeWidth={2} dot={{ r: 3 }} name="Actual" />
              <Line type="monotone" dataKey="predicted" stroke="var(--accent-amber)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Predicted" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
