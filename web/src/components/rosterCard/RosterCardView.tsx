import { forwardRef, useEffect, useRef, useState } from 'react';
import { Baby, Cake, Clapperboard, Globe, Hand, Hourglass, House, Play, Ruler, Shirt, Weight, type LucideIcon } from 'lucide-react';
import type { RosterCard } from '../../lib/rosterCard';
import '../home/home.css';
import './rosterCard.css';

export const CARD_WIDTH = 540;
export const CARD_HEIGHT = 675;

const FACT_ICONS: Record<string, LucideIcon> = {
  birthday: Cake,
  number: Shirt,
  hometown: House,
  youtube: Play,
  babysat: Baby,
  born: Clapperboard,
  height: Ruler,
  weight: Weight,
  countries: Globe,
  righties: Hand,
  age: Hourglass,
};

/** The best-known players by last name, for the "Starring" line. */
function starring(card: RosterCard): string {
  const names = [...card.players]
    .sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999))
    .map((player) => player.name.split(' ').slice(1).join(' ') || player.name);
  const shown = names.slice(0, 6);
  const more = names.length - shown.length;
  return more > 0 ? `${shown.join(', ')} and ${more} more` : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

function nameSize(name: string): number {
  if (name.length <= 12) return 60;
  if (name.length <= 18) return 50;
  if (name.length <= 26) return 42;
  return 36;
}

/**
 * The card itself, always 540 x 675 (4:5, exported at 2x for Instagram and group chats).
 * Plain text and inline icons only, so it renders the same in the image as on screen.
 */
export const RosterCardView = forwardRef<HTMLDivElement, { card: RosterCard }>(function RosterCardView({ card }, ref) {
  const size = nameSize(card.teamName);
  return (
    <div ref={ref} className="roster-card-foil rounded-[30px] p-[4px]" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <div className="roster-card-face relative flex h-full flex-col overflow-hidden rounded-[26px] px-9 pb-7 pt-7">
        <div className="ice-cracks pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative flex items-center justify-between">
          <span className="flex items-center gap-2">
            <img src="/logo-mark.svg" alt="" className="size-7" />
            <span className="font-display text-[15px] font-extrabold tracking-wide text-[#f2fbff]">CRACKED ICE</span>
          </span>
          <span className="inline-block h-7 rounded-full border border-[#63e6ff]/40 px-3 text-[12px] font-semibold leading-[26px] text-[#63e6ff]">{card.players.length} players</span>
        </div>

        <h2 className="roster-card-name relative mt-9" style={{ fontSize: size, lineHeight: 0.98 }}>{card.teamName}</h2>

        <div className="relative mt-7">
          <span className="roster-card-stamp inline-block rounded-md px-3 text-[21px] leading-[38px]"><span data-export-shift-y="-4">{card.verdict.title}</span></span>
          <p className="mt-4 text-[19px] font-medium leading-snug text-[#dcecf5]">{card.verdict.roast}</p>
        </div>

        <ul className="relative mt-6 space-y-3.5 border-t border-[#63e6ff]/20 pt-5">
          {card.facts.map((fact) => {
            const Icon = FACT_ICONS[fact.key] ?? Hourglass;
            return (
              <li key={fact.key} className="flex gap-3 text-[16px] leading-snug text-[#b9cfdc]">
                <Icon size={18} className="mt-[2px] shrink-0 text-[#63e6ff]" aria-hidden="true" />
                <span>{fact.text}</span>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-auto space-y-1.5 border-t border-[#63e6ff]/20 pt-3.5 text-[13.5px] leading-snug">
          <p className="text-[#b9cfdc]"><span className="font-semibold text-[#f2fbff]">Starring </span>{starring(card)}</p>
          {card.badges.length > 0 && <p className="text-[#b9cfdc]"><span className="font-semibold text-[#ffd27e]">Also qualifies as </span>{card.badges.join(', ')}</p>}
        </div>

        <div className="relative mt-3 flex items-end justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {card.countries.slice(0, 6).map((country) => (
              <span key={country.code} className="inline-block h-6 rounded-md border border-[#f2fbff]/15 bg-[#f2fbff]/5 px-2 text-[12px] font-semibold leading-[22px] text-[#dcecf5]">
                {country.code} <span className="text-[#63e6ff]">{country.count}</span>
              </span>
            ))}
            {card.averageAge !== null && <span className="inline-block h-6 rounded-md border border-[#ffd27e]/30 px-2 text-[12px] font-semibold leading-[22px] text-[#ffd27e]">Avg age {card.averageAge}</span>}
          </div>
          <span className="shrink-0 text-right text-[12.5px] font-semibold text-[#63e6ff]">crackedicehockey.com/card</span>
        </div>
      </div>
    </div>
  );
});

/** Shows the fixed-size card scaled down to fit narrower screens. */
export function ScaledRosterCard({ card, cardRef, animateKey }: { card: RosterCard; cardRef?: React.Ref<HTMLDivElement>; animateKey?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const update = () => setScale(Math.min(1, element.clientWidth / CARD_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frame} className="w-full max-w-[540px]" style={{ height: CARD_HEIGHT * scale }}>
      <div style={{ width: CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div key={animateKey} className="roster-card-enter">
          <RosterCardView ref={cardRef} card={card} />
        </div>
      </div>
    </div>
  );
}
