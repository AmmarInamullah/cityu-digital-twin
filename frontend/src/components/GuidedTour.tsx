'use client';
import { useState, useEffect, useCallback } from 'react';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Resilience Score',
    description: 'A composite indicator inspired by Chopra\'s S-DReP methodology. Three pillars: Energy Performance (40%), CO2 Trajectory (35%), and Operational Adaptability (25%). Each pillar scores 0-100, weighted into a single resilience metric.',
    targetId: 'section-resilience',
  },
  {
    title: 'Energy Consumption',
    description: 'Hourly and daily energy data calibrated against CityU\'s real 2023-24 Environmental Report (53.1M kWh annual total). The synthetic generator produces realistic weekday/weekend and seasonal patterns. Switch between daily trend and hourly profile views.',
    targetId: 'section-energy',
  },
  {
    title: '7-Year Historical Trend',
    description: 'All seven years of real YEUNG Building data from CityU\'s published reports. Notice the COVID dip in 2020-21 and the sharp rebound in 2023-24 as campus activity fully resumed.',
    targetId: 'section-historical',
  },
  {
    title: 'Path to Net-Zero',
    description: 'CityU\'s 2030 target is an 8% reduction in GHG per floor area vs. 2018-19. The red line shows actual performance, the green dashed line shows the required trajectory. Currently 7.69% above baseline, moving in the wrong direction.',
    targetId: 'section-netzero',
  },
  {
    title: 'What-If Simulator',
    description: 'Interactive scenario modeling with transparent, explainable multipliers. Adjust occupancy, AC setpoint, lighting efficiency, or toggle CityU\'s real planned solar installation. Each adjustment recalculates resilience, CO2, and energy in real time.',
    targetId: 'section-whatif',
  },
  {
    title: 'Floor Plan Heat Map',
    description: 'Zones colored by energy intensity using real YEUNG breakdown percentages. General Lighting & AC (35.7%) and Laboratory Power (27.9%) are the largest consumers. Hover for per-zone daily kWh and CO2 figures.',
    targetId: 'section-floorplan',
  },
  {
    title: 'Manage the Building',
    description: 'A gamification mode inspired by BESSE\'s decision-feedback loop. Make discrete facilities management decisions (disable AC, install sensors, delay chiller startup) and watch energy savings vs. comfort tradeoffs play out in real time.',
    targetId: 'section-game',
  },
  {
    title: 'GHG Scope Breakdown',
    description: 'Campus-wide Scope 1/2/3 breakdown from CityU\'s own Environmental Report. Scope 2 (electricity) dominates at 91.7%, which is where this building\'s simulated energy data directly maps. Scopes 1 and 3 are real published reference figures.',
    targetId: 'section-ghg',
  },
];

export default function GuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;

  const scrollToTarget = useCallback((targetId: string) => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight
      el.style.outline = '2px solid var(--accent-teal)';
      el.style.outlineOffset = '8px';
      el.style.borderRadius = '12px';
      el.style.transition = 'outline 0.3s ease';
    }
  }, []);

  const clearHighlights = useCallback(() => {
    TOUR_STEPS.forEach(s => {
      const el = document.getElementById(s.targetId);
      if (el) {
        el.style.outline = 'none';
        el.style.outlineOffset = '0px';
      }
    });
  }, []);

  const startTour = () => {
    setIsActive(true);
    setCurrentStep(0);
    scrollToTarget(TOUR_STEPS[0].targetId);
  };

  const nextStep = () => {
    clearHighlights();
    if (isLast) {
      setIsActive(false);
      clearHighlights();
      return;
    }
    const next = currentStep + 1;
    setCurrentStep(next);
    scrollToTarget(TOUR_STEPS[next].targetId);
  };

  const prevStep = () => {
    clearHighlights();
    if (isFirst) return;
    const prev = currentStep - 1;
    setCurrentStep(prev);
    scrollToTarget(TOUR_STEPS[prev].targetId);
  };

  const endTour = () => {
    setIsActive(false);
    clearHighlights();
    setCurrentStep(0);
  };

  // Start tour button (floating)
  if (!isActive) {
    return (
      <button
        onClick={startTour}
        className="fixed bottom-6 right-6 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg z-50 flex items-center gap-2 transition-transform hover:scale-105"
        style={{ background: 'var(--accent-teal)', color: '#0a0f1a' }}
      >
        <span>▶</span> Start Tour
      </button>
    );
  }

  // Tour overlay
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="rounded-xl p-5 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        {/* Progress bar */}
        <div className="flex gap-1 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= currentStep ? 'var(--accent-teal)' : 'var(--bg-primary)' }}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="text-xs mb-1" style={{ color: 'var(--accent-teal)' }}>
          Step {currentStep + 1} of {TOUR_STEPS.length}
        </div>
        <h3 className="text-base font-semibold mb-2">{step.title}</h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {step.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={endTour}
            className="text-xs px-3 py-1.5 rounded"
            style={{ color: 'var(--text-muted)' }}
          >
            End Tour
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="text-xs px-3 py-1.5 rounded"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Previous
              </button>
            )}
            <button
              onClick={nextStep}
              className="text-xs px-4 py-1.5 rounded font-medium"
              style={{ background: 'var(--accent-teal)', color: '#0a0f1a' }}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
