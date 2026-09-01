import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeeperIntakePanel } from './KeeperIntakePanel';

describe('KeeperIntakePanel', () => {
  it('summarizes both keeper pools without opening the bulk editor', () => {
    const markup = renderToStaticMarkup(<KeeperIntakePanel
      players={[]}
      unavailableIds={new Set(['opponent-1', 'opponent-2'])}
      myKeeperIds={new Set(['mine-1'])}
      hasDraftPosition
      onApplyMyKeepers={() => undefined}
      onApplyOpponentKeepers={() => undefined}
      onClearOpponentKeepers={() => undefined}
    />);

    expect(markup).toContain('Keeper setup');
    expect(markup).toContain('1 mine');
    expect(markup).toContain('2 league-mate keepers removed');
    expect(markup).toContain('Bulk add');
  });
});
