import { useState, useEffect } from 'react';
import { ScoreboardBanner } from '../components/ScoreboardBanner';
import { WeeklyScheduleGrid } from '../components/WeeklyScheduleGrid';
import { getCurrentWeekIso, getPrevWeekIso, getNextWeekIso, fetchWeeklyScheduleData, type WeeklySchedule } from '../lib/schedule';


export function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekIso());
  const [scheduleData, setScheduleData] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle global navigation when not focused on interactive elements
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'BUTTON' ||
          document.activeElement?.tagName === 'SELECT') {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentWeek(prev => getPrevWeekIso(prev));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentWeek(prev => getNextWeekIso(prev));
      } else if (event.key === 'h' || event.key === 'H') {
        // H for Help - show keyboard shortcuts
        event.preventDefault();
        alert('Keyboard shortcuts:\n← → Navigate weeks\nTab: Move between elements\nEnter: Activate focused element\nH: Show this help');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const loadScheduleData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch real schedule data from API
        const data = await fetchWeeklyScheduleData(currentWeek);
        setScheduleData(data);
      } catch (err) {
        console.error('Failed to load schedule data:', err);
        setError('Failed to load schedule data');
      } finally {
        setLoading(false);
      }
    };

    loadScheduleData();
  }, [currentWeek]);

  const handleWeekChange = (newWeek: string) => {
    setCurrentWeek(newWeek);
  };

  return (
    <main className="min-h-screen ice-rink-bg">
      {/* Faint ice overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('/textures/ice-noise.png')] bg-cover" />
      
      <div className="relative z-10 container mx-auto px-4 py-6 space-y-6">
        <ScoreboardBanner 
          weekIso={currentWeek} 
          onWeekChange={handleWeekChange}
        />
        
        <section 
          className="glass glow-border p-4 md:p-6 space-y-4 relative"
          style={{ 
            minHeight: '800px', 
            height: 'auto', 
            overflow: 'visible',
            display: 'block',
            width: '100%',
            background: 'linear-gradient(135deg, var(--glass-bg), var(--glass-fill-hover))',
            backdropFilter: 'var(--frost-blur)',
            WebkitBackdropFilter: 'var(--frost-blur)'
          }}
        >
          {/* Schedule Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--laser-cyan)] mb-4"></div>
                <p className="text-[var(--ci-muted)]">Loading schedule...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : scheduleData ? (
            <div style={{ minHeight: '600px', height: 'auto', overflow: 'visible' }}>
              <WeeklyScheduleGrid data={scheduleData} />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--ci-muted)]">No schedule data available</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}