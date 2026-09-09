import { CheckCircle2, ClipboardPaste, Settings2 } from 'lucide-react';
import type { RosterReadinessState } from '../../lib/homeReadiness';
import { Button } from '../ui/button';

export function RosterReadinessBanner({ state, rosterCount, onImport, onReviewRules, onConfirm }: { state: RosterReadinessState; rosterCount: number; onImport: () => void; onReviewRules: () => void; onConfirm: () => void }) {
  if (state === 'ready') return null;
  const empty = state === 'none';
  return <section className="mb-3 rounded-xl border border-warning/50 bg-warning-muted p-4 sm:p-5" aria-labelledby="roster-readiness-heading"><p className="scoreboard-text text-warning">{empty ? 'START HERE' : state === 'incomplete' ? 'SETUP INCOMPLETE' : 'SETUP NEEDS REVIEW'}</p><h2 id="roster-readiness-heading" className="mt-1 text-xl font-semibold text-ink">{empty ? 'Add your roster before analyzing it' : 'Review the roster before trusting opportunity totals'}</h2><p className="mt-2 text-sm text-ink-dim">{empty ? 'Paste names, add players manually, or use a cropped screenshot.' : `${rosterCount} players are saved. Confirm duplicates, eligibility, lineup rules, and any intentional vacancies.`}</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={onImport}><ClipboardPaste size={16} />{empty ? 'Import roster' : 'Add missing players'}</Button><Button variant="ghost" onClick={onReviewRules}><Settings2 size={16} />Review rules</Button>{!empty && <Button variant="ghost" onClick={onConfirm}><CheckCircle2 size={16} />Roster is complete</Button>}</div></section>;
}
