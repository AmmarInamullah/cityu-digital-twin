'use client';
import GameMode from '@/components/GameMode';

export default function GameView() {
  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Building Management Game</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Make facilities management decisions and optimize the building's resilience score.
          Inspired by the BESSE circular-economy game mechanics.
        </p>
      </div>
      <div className="p-8">
        <GameMode />
      </div>
    </div>
  );
}
