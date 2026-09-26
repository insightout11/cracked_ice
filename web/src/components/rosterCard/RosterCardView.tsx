import { forwardRef, useEffect, useRef, useState } from 'react';
import { Baby, Bandage, Cake, CalendarDays, Clapperboard, Crown, Globe, Goal, Hand, Hourglass, House, ListOrdered, Medal, Plane, Ruler, Shield, Shirt, Sprout, Star, Stethoscope, Ticket, Timer, Trophy, Users, Weight, type LucideIcon } from 'lucide-react';
import { rosterGroups, type RosterCard } from '../../lib/rosterCard';
import '../home/home.css';
import './rosterCard.css';

export const CARD_WIDTH = 540;
export const CARD_HEIGHT = 675;

/** One icon per card trait (see lib/rosterCardTraits.ts). */
const FACT_ICONS: Record<string, LucideIcon> = {
  'age-old': Hourglass,
  'age-young': Hourglass,
  'debut-before-born': Clapperboard,
  'under-21': Baby,
  homer: Shirt,
  'hurt-now': Stethoscope,
  'games-missed': Bandage,
  'first-overall': Crown,
  'top-ten-picks': Crown,
  undrafted: Ticket,
  'latest-pick': Ticket,
  cups: Trophy,
  'cupless-veterans': Trophy,
  'major-awards': Medal,
  legends: Star,
  rookies: Sprout,
  'career-games': ListOrdered,
  journeyman: Plane,
  'pim-high': Timer,
  'pim-low': Timer,
  'goal-share': Goal,
  'goals-high': Goal,
  'goals-low': Goal,
  'goalie-hoard': Shield,
  'old-goalies': Shield,
  'defense-heavy': Shield,
  countries: Globe,
  nation: Globe,
  birthday: Cake,
  hometown: House,
  'jersey-twins': Shirt,
  'first-names': Users,
  'early-birthdays': CalendarDays,
  heavy: Weight,
  'size-gap': Ruler,
  lefties: Hand,
};

function nameSize(name: string): number {
  if (name.length <= 12) return 60;
  if (name.length <= 18) return 50;
  if (name.length <= 26) return 42;
  return 36;
}

/** Savage roasts run longer; step the type down so the facts below still fit the card. */
function roastSize(roast: string): number {
  if (roast.length > 200) return 16;
  if (roast.length > 165) return 17.5;
  return 19;
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
          <span className="roster-card-stamp inline-block rounded-md px-3 text-[21px] leading-[38px]">{card.verdict.title}</span>
          <p className="mt-4 font-medium leading-snug text-[#dcecf5]" style={{ fontSize: roastSize(card.verdict.roast) }}>{card.verdict.roast}</p>
        </div>

        <ul className="relative mt-6 space-y-4 border-t border-[#63e6ff]/20 pt-5">
          {card.facts.map((fact) => {
            const Icon = FACT_ICONS[fact.key] ?? Star;
            return (
              <li key={fact.key} className="flex gap-3 text-[16.5px] leading-snug text-[#c9dbe6]">
                <Icon size={19} className="mt-[2px] shrink-0 text-[#63e6ff]" aria-hidden="true" />
                <span>{fact.text}</span>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-auto flex items-end justify-between gap-4 pt-4">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {card.badges.map((badge) => (
              <span key={badge} className="inline-block h-6 rounded-md border border-[#ffd27e]/40 px-2 text-[12px] font-semibold leading-[22px] text-[#ffd27e]">{badge}</span>
            ))}
            {card.showCountries && card.countries.slice(0, 5).map((country) => (
              <span key={country.code} className="inline-block h-6 rounded-md border border-[#f2fbff]/15 bg-[#f2fbff]/5 px-2 text-[12px] font-semibold leading-[22px] text-[#dcecf5]">
                {country.code} <span className="text-[#63e6ff]">{country.count}</span>
              </span>
            ))}
          </div>
          <span className="shrink-0 text-right text-[12.5px] font-semibold text-[#63e6ff]">crackedicehockey.com/card</span>
        </div>
      </div>
    </div>
  );
});

/** The back of the card: the whole lineup, like the stats side of a hockey card. */
export const RosterCardBack = forwardRef<HTMLDivElement, { card: RosterCard }>(function RosterCardBack({ card }, ref) {
  return (
    <div ref={ref} className="roster-card-foil rounded-[30px] p-[4px]" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <div className="roster-card-face relative flex h-full flex-col overflow-hidden rounded-[26px] px-9 pb-7 pt-7">
        <div className="ice-cracks pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative flex items-center justify-between">
          <span className="flex items-center gap-2">
            <img src="/logo-mark.svg" alt="" className="size-7" />
            <span className="font-display text-[15px] font-extrabold tracking-wide text-[#f2fbff]">CRACKED ICE</span>
          </span>
          <span className="inline-block h-7 rounded-full border border-[#63e6ff]/40 px-3 text-[12px] font-semibold leading-[26px] text-[#63e6ff]">The lineup</span>
        </div>
        <h2 className="roster-card-name relative mt-6 text-[32px] leading-[1.02]">{card.teamName}</h2>
        <p className="relative mt-2 text-[15px] font-semibold text-[#ffd27e]">{card.verdict.title}</p>
        <div className="relative mt-5 space-y-4 border-t border-[#63e6ff]/20 pt-4">
          {rosterGroups(card.players).map((group) => (
            <section key={group.label}>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#63e6ff]">{group.label}</h3>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-6">
                {group.players.map((player) => (
                  <li key={player.id} className="flex items-baseline justify-between gap-2 overflow-hidden whitespace-nowrap text-[14.5px] leading-[23px] text-[#dcecf5]">
                    <span className="overflow-hidden">{player.name}</span>
                    <span className="shrink-0 text-[11.5px] font-semibold text-[#8fb3c7]">{player.team}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="relative mt-auto flex items-end justify-between pt-4">
          <span className="text-[12.5px] font-semibold text-[#8fb3c7]">{card.players.length} players</span>
          <span className="text-[12.5px] font-semibold text-[#63e6ff]">crackedicehockey.com/card</span>
        </div>
      </div>
    </div>
  );
});

/** Shows the fixed-size card (either side) scaled down to fit narrower screens. */
export function ScaledRosterCard({ card, cardRef, animateKey, side = 'front' }: { card: RosterCard; cardRef?: React.Ref<HTMLDivElement>; animateKey?: string; side?: 'front' | 'back' }) {
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
        <div key={`${animateKey}-${side}`} className="roster-card-enter">
          {side === 'front' ? <RosterCardView ref={cardRef} card={card} /> : <RosterCardBack ref={cardRef} card={card} />}
        </div>
      </div>
    </div>
  );
}
