import { useMemo, useState } from 'react';

interface GameData {
  opponent: string;
  isHome: boolean;
  opponentLogo?: string;
}

interface DayData {
  date: string;
  id: string;
  game?: GameData;
  isOff?: boolean;
}

interface TeamData {
  name: string;
  logo: string;
  days: DayData[];
  total: number;
}

const mockData: TeamData[] = [
  {
    name: 'Boston Bruins',
    logo: '/logos/BOS.svg',
    total: 3,
    days: [
      { date: 'Oct 13', id: 'mon', isOff: true },
      { date: 'Oct 14', id: 'tue', game: { opponent: 'NYR', isHome: false } },
      { date: 'Oct 15', id: 'wed' },
      { date: 'Oct 16', id: 'thu', game: { opponent: 'NJD', isHome: true } },
      { date: 'Oct 17', id: 'fri' },
      { date: 'Oct 18', id: 'sat', game: { opponent: 'WSH', isHome: true } },
      { date: 'Oct 19', id: 'sun' },
    ]
  },
  {
    name: 'New York Rangers',
    logo: '/logos/NYR.svg',
    total: 4,
    days: [
      { date: 'Oct 13', id: 'mon', game: { opponent: 'PHI', isHome: true } },
      { date: 'Oct 14', id: 'tue', game: { opponent: 'BOS', isHome: true } },
      { date: 'Oct 15', id: 'wed', isOff: true },
      { date: 'Oct 16', id: 'thu', game: { opponent: 'CAR', isHome: false } },
      { date: 'Oct 17', id: 'fri', game: { opponent: 'PIT', isHome: false } },
      { date: 'Oct 18', id: 'sat' },
      { date: 'Oct 19', id: 'sun' },
    ]
  },
  {
    name: 'Toronto Maple Leafs',
    logo: '/logos/TOR.svg',
    total: 2,
    days: [
      { date: 'Oct 13', id: 'mon' },
      { date: 'Oct 14', id: 'tue', isOff: true },
      { date: 'Oct 15', id: 'wed', game: { opponent: 'MTL', isHome: true } },
      { date: 'Oct 16', id: 'thu' },
      { date: 'Oct 17', id: 'fri', game: { opponent: 'OTT', isHome: false } },
      { date: 'Oct 18', id: 'sat' },
      { date: 'Oct 19', id: 'sun', isOff: true },
    ]
  },
  {
    name: 'Montreal Canadiens',
    logo: '/logos/MTL.svg',
    total: 3,
    days: [
      { date: 'Oct 13', id: 'mon', game: { opponent: 'VAN', isHome: false } },
      { date: 'Oct 14', id: 'tue' },
      { date: 'Oct 15', id: 'wed', game: { opponent: 'TOR', isHome: false } },
      { date: 'Oct 16', id: 'thu', isOff: true },
      { date: 'Oct 17', id: 'fri' },
      { date: 'Oct 18', id: 'sat', game: { opponent: 'DET', isHome: true } },
      { date: 'Oct 19', id: 'sun' },
    ]
  },
  {
    name: 'Tampa Bay Lightning',
    logo: '/logos/TBL.svg',
    total: 4,
    days: [
      { date: 'Oct 13', id: 'mon', game: { opponent: 'FLA', isHome: true } },
      { date: 'Oct 14', id: 'tue', game: { opponent: 'CAR', isHome: false } },
      { date: 'Oct 15', id: 'wed', game: { opponent: 'NSH', isHome: true } },
      { date: 'Oct 16', id: 'thu' },
      { date: 'Oct 17', id: 'fri', isOff: true },
      { date: 'Oct 18', id: 'sat', game: { opponent: 'COL', isHome: false } },
      { date: 'Oct 19', id: 'sun' },
    ]
  },
  {
    name: 'Florida Panthers',
    logo: '/logos/FLA.svg',
    total: 3,
    days: [
      { date: 'Oct 13', id: 'mon', game: { opponent: 'TBL', isHome: false } },
      { date: 'Oct 14', id: 'tue', isOff: true },
      { date: 'Oct 15', id: 'wed' },
      { date: 'Oct 16', id: 'thu', game: { opponent: 'BUF', isHome: true } },
      { date: 'Oct 17', id: 'fri', game: { opponent: 'ANA', isHome: true } },
      { date: 'Oct 18', id: 'sat' },
      { date: 'Oct 19', id: 'sun', isOff: true },
    ]
  }
];

export function ScheduleV2() {
  const [currentWeek] = useState('Week of October 13, 2025');

  // Simple week analytics from the mock data to power the totals rail
  const analytics = useMemo(() => {
    return mockData.map((team) => {
      const gamesPerDay = team.days.map((d) => (d.game ? 1 : 0));
      const games = gamesPerDay.reduce((a: number, b: number) => a + b, 0);
      // "OFF" here means a scheduled off night marker or no game on typical lighter nights
      // For the mock, use explicit isOff flag when provided
      const off = team.days.filter((d) => !!d.isOff).length;
      // Back-to-backs: consecutive days with games
      let b2b = 0;
      for (let i = 1; i < gamesPerDay.length; i++) {
        if (gamesPerDay[i] === 1 && gamesPerDay[i - 1] === 1) b2b += 1;
      }
      return { games, off, b2b };
    });
  }, []);

  const handlePrevWeek = () => {
    // Future: implement week navigation
  };

  const handleNextWeek = () => {
    // Future: implement week navigation
  };

  const renderCell = (day: DayData) => {
    if (day.isOff) {
      return <span className="cell off">OFF</span>;
    }
    
    if (day.game) {
      return (
        <span className="cell game">
          {day.game.isHome ? 'vs' : '@'} {day.game.opponent}
        </span>
      );
    }
    
    return <span className="cell empty"></span>;
  };

  return (
    <div className="page-v2">
      {/* Header */}
      <header className="chrome">
        <div className="brand">NHL WEEKLY SCHEDULE</div>
        <div className="week-controls">
          <button className="pill" aria-label="Previous week" onClick={handlePrevWeek}>
            ‹
          </button>
          <div className="picker">
            <button className="glass">{currentWeek}</button>
          </div>
          <button className="pill" aria-label="Next week" onClick={handleNextWeek}>
            ›
          </button>
        </div>
      </header>
      {/* Schedule Panel */}
      <section className="panel">
        <div className="table">
          <div className="thead">
            <div className="th team">Team</div>
            <div className="th day">Mon<br/><span>Oct 13</span></div>
            <div className="th day">Tue<br/><span>Oct 14</span></div>
            <div className="th day">Wed<br/><span>Oct 15</span></div>
            <div className="th day">Thu<br/><span>Oct 16</span></div>
            <div className="th day">Fri<br/><span>Oct 17</span></div>
            <div className="th day">Sat<br/><span>Oct 18</span></div>
            <div className="th day">Sun<br/><span>Oct 19</span></div>
            <div className="th total">Total</div>
          </div>

          {mockData.map((team, index) => (
            <div key={team.name} className={`tr ${index % 2 === 1 ? 'zebra' : ''}`}>
              <div className="td team">
                <img src={team.logo} alt="" className="logo" />
                <div className="name">{team.name}</div>
              </div>
              {team.days.map((day) => (
                <div key={day.id} className="td day">
                  {renderCell(day)}
                </div>
              ))}
              <div className="td total">
                <div className='grid gap-[8] items-center [justify-items:center]'>
                  <div className='grid gap-[2]'>
                    <div className='total-pill leading-[1]'>{analytics[index]?.games ?? team.total}</div>
                    <div className='text-[11] opacity-[0.85] text-ink-mute'>games</div>
                  </div>
                  <div className='grid gap-[8] w-[180]'>
                    <div className='grid [grid-template-columns:auto_1fr_auto] items-center gap-[8]'>
                      <span className='text-[11] text-accent'>OFF</span>
                      <div className='relative h-[8] w-[100%] bg-line rounded-[999] overflow-hidden'>
                        <div
                          style={{
                            width: `${Math.min(100, (analytics[index]?.games ? (analytics[index]!.off / analytics[index]!.games) * 100 : 0)).toFixed(0)}%`
                          }}
                          className='absolute [inset:0] [background:linear-gradient(90deg,_var(--accent),_var(--accent))] [box-shadow:0_0_8px_var(--accent-muted)]' />
                      </div>
                      <span className='text-[11] opacity-[0.9]'>{analytics[index]?.off ?? 0}</span>
                    </div>
                    <div className='grid [grid-template-columns:auto_1fr_auto] items-center gap-[8]'>
                      <span className='text-[11] text-warning'>B2B</span>
                      <div className='relative h-[8] w-[100%] bg-line rounded-[999] overflow-hidden'>
                        <div
                          style={{
                            width: `${Math.min(100, (analytics[index]?.games ? (analytics[index]!.b2b / analytics[index]!.games) * 100 : 0)).toFixed(0)}%`
                          }}
                          className='absolute [inset:0] [background:linear-gradient(90deg,_var(--warning),_var(--warning))] [box-shadow:0_0_8px_var(--warning-muted)]' />
                      </div>
                      <span className='text-[11] opacity-[0.9]'>{analytics[index]?.b2b ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
