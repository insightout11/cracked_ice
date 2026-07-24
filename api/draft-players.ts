import { loadDraftPlayerDirectory, parseDraftLeagueProfile } from './_lib/player-directory.js';
import { handleCors } from './_lib/respond.js';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  try {
    const query = String(req.query.q ?? '').trim().toLocaleLowerCase();
    const team = String(req.query.team ?? '').trim().toUpperCase();
    const positions = new Set(
      String(req.query.positions ?? '')
        .split(',')
        .map((position) => position.trim().toUpperCase())
        .filter(Boolean)
    );
    const requestedLimit = Number(req.query.limit ?? (query ? 12 : 2000));
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 2000)
      : 12;

    const directory = loadDraftPlayerDirectory(parseDraftLeagueProfile(req.query.profile));
    let players = directory.players;
    if (team) players = players.filter((player) => player.team === team);
    if (positions.size) {
      players = players.filter((player) => player.pos.some((position) => positions.has(position)));
    }

    if (query) {
      players = players
        .map((player) => {
          const name = player.name.toLocaleLowerCase();
          const aliases = player.aliases.map((alias) => alias.toLocaleLowerCase());
          const score = name === query
            ? 0
            : name.startsWith(query)
              ? 1
              : aliases.some((alias) => alias === query)
                ? 2
                : aliases.some((alias) => alias.startsWith(query))
                  ? 3
                  : name.includes(query)
                    ? 4
                    : aliases.some((alias) => alias.includes(query))
                      ? 5
                      : 99;
          return { player, score };
        })
        .filter(({ score }) => score < 99)
        .sort((a, b) =>
          a.score - b.score ||
          (b.player.productionValue ?? -1) - (a.player.productionValue ?? -1) ||
          a.player.name.localeCompare(b.player.name)
        )
        .map(({ player }) => player);
    } else {
      players = [...players].sort((a, b) =>
        (b.productionValue ?? -1) - (a.productionValue ?? -1) || a.name.localeCompare(b.name)
      );
    }

    return res.json({ players: players.slice(0, limit), meta: directory.meta });
  } catch (error: any) {
    console.error('[draft-players] error:', error);
    return res.status(500).json({ error: 'draft_players_failed', message: error?.message });
  }
}
