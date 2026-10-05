import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { rostersAreFresh } from '../../lib/startingRostersImport';

function ago(timestamp: string, now = Date.now()): string {
  const hours = Math.max(0, Math.round((now - new Date(timestamp).getTime()) / 3_600_000));
  if (hours < 1) return 'just now';
  if (hours < 36) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Recommendations are only as good as the league rosters behind them, so the home page says how current they are. */
export function RostersStatusLine({ workspace }: { workspace: LeagueWorkspace }) {
  const rosters = workspace.leagueRosters;
  const fresh = rostersAreFresh(workspace);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${fresh ? 'border-line bg-surface-1' : 'border-warning/60 bg-surface-1'}`}>
      <p className="flex items-center gap-2 text-ink">
        <Users size={15} className={fresh ? 'text-accent' : 'text-warning'} aria-hidden="true" />
        {rosters?.teams.length
          ? <span>League rosters <span className={fresh ? 'text-ink-dim' : 'text-warning'}>updated {ago(rosters.updatedAt)}</span></span>
          : <span>Add your league's rosters <span className="text-ink-dim">so picks only show players nobody has.</span></span>}
      </p>
      <Link to="/team#league-rosters" className="text-xs font-semibold text-accent hover:underline">{rosters?.teams.length ? 'Update' : 'Add them (30 sec)'}</Link>
    </div>
  );
}
