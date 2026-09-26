/** Built by scripts/weekly/video-props.mjs from the weekly JSON and the editorial file. */
// A type alias (not an interface) so Remotion accepts it as composition props.
export type WeekProps = {
  start: string;
  weekNumber: number;
  weekLabel: string;
  totalGames: number;
  quietNights: number;
  packedNight: { day: string; games: number; room: number } | null;
  nights: Array<{ date: string; label: string; games: number; light: boolean; packed: boolean; room: number }>;
  chain: {
    title: string;
    dates: string[];
    labels: string[];
    legs: Array<{ team: string; from: string; to: string; games: string[] }>;
    bridge: { team: string; games: string[] } | null;
    usable: number | null;
  };
  quickHits: Record<'week' | 'twoWeeks' | 'month', Array<{ team: string; note: string }>>;
};
