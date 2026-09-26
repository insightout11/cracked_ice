import type { RosterPlayer } from '../../lib/coachSchemas';

/** A player's name that opens his profile; plain text when there's nowhere to open it. */
export function PlayerNameLink({ player, onOpen, className = '' }: { player: RosterPlayer; onOpen?: (player: RosterPlayer) => void; className?: string }) {
  if (!onOpen) return className ? <span className={className}>{player.full_name}</span> : <>{player.full_name}</>;
  return (
    <button type="button" onClick={() => onOpen(player)} className={`text-left underline decoration-line decoration-dotted underline-offset-2 hover:text-accent hover:decoration-accent ${className}`} title={`Open ${player.full_name}'s profile`}>
      {player.full_name}
    </button>
  );
}
