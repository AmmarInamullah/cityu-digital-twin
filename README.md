# CityU Campus Resilience Digital Twin

A digital twin of CityU's YEUNG Building that operationalizes the S-DReP resilience indicator methodology. Combines real energy data from CityU's published Environmental Reports, climate hazard exposure modeling, and interactive scenario simulation into a composite resilience dashboard with decision-support capabilities.

**Built as a portfolio project for a Research Assistant position under Prof. Chopra, School of Energy and Environment, CityU.**

## Architecture

```
backend/          Node.js + Express + TypeScript + MongoDB + Socket.IO
  src/
    config/       Environment validation, DB connection
    constants/    Real CityU data, CO2 factors, resilience weights
    controllers/  Request handlers
    models/       Mongoose schemas (BuildingProfile, SensorReading, ResilienceScore, Alert, Forecast)
    routes/       Express route definitions
    services/     Business logic (resilience calculation, readings, WebSocket)
    scripts/      Database seeding + synthetic data generation
    middleware/   Error handling

frontend/         Next.js + React + TypeScript + Tailwind + Zustand + Recharts
  (to be built)

ml/               Python (scikit-learn) forecasting + anomaly detection
  (to be built)
```

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI

npm install
npm run seed          # Creates YEUNG Building profile
npm run generate-data # Generates 1 year of hourly data (~35k readings)
npm run dev           # Starts the API on port 5000
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/buildings` | List buildings |
| GET | `/api/buildings/:id` | Get building profile |
| GET | `/api/buildings/historical-data` | 7-year real CityU dataset |
| GET | `/api/buildings/ghg-scopes` | Scope 1/2/3 GHG breakdown |
| POST | `/api/readings` | Submit sensor readings |
| GET | `/api/readings/:buildingId` | Query readings (with ?from, ?to, ?metricType filters) |
| GET | `/api/readings/:buildingId/daily` | Daily consumption aggregates |
| GET | `/api/readings/:buildingId/hourly?date=YYYY-MM-DD` | Hourly consumption for a day |
| GET | `/api/readings/:buildingId/zones` | Zone energy breakdown |
| GET | `/api/resilience/:buildingId/current` | Current resilience score |
| POST | `/api/resilience/:buildingId/simulate` | What-if scenario simulation |
| GET | `/api/resilience/:buildingId/history` | Historical resilience scores |
| GET | `/api/alerts/:buildingId` | Get alerts |
| GET | `/api/alerts/:buildingId/stats` | Alert statistics |
| PATCH | `/api/alerts/:alertId/resolve` | Resolve an alert |

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `subscribe:building` | Client -> Server | Subscribe to a building's updates |
| `reading:new` | Server -> Client | New sensor reading stored |
| `alert:new` | Server -> Client | New alert triggered |
| `resilience:update` | Server -> Client | Resilience score updated |

## Real Data Sources

All calibration data comes from CityU's publicly published Environmental Reports (2017-18 through 2023-24):

- YEUNG Building annual consumption: 53.1 million kWh (2023-24)
- CO2 factor: 0.34 kg CO2e/kWh (CLP Power Hong Kong, 2025)
- Zone breakdown: General Lighting & AC 35.7%, Laboratory Power 27.9%, Chiller Plant 27.1%
- GHG target: 8% reduction per floor area vs 2018-19 baseline by 2030
- Current status: 7.69% ABOVE baseline (moving away from target)

## Resilience Score Framework

Three-pillar composite inspired by Chopra's S-DReP methodology:

1. **Energy Performance (40%)** - Efficiency vs daily kWh baseline
2. **CO2 Trajectory (35%)** - Emissions relative to 2030 target path
3. **Operational Adaptability (25%)** - System stability, anomaly frequency

## License

MIT
