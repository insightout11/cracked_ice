/**
 * The Cracked Ice schedule card: an MCP Apps UI resource that ChatGPT renders inline when
 * get_weekly_nhl_schedule, find_streaming_teams or check_roster_schedule runs. It draws the
 * tool's existing structuredContent (no schedule math of its own) under the Cracked Ice
 * wordmark, so the source of the analysis is visible. Clients without MCP Apps UI ignore it
 * and use the tool's text answer.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Versioned: change the file name when the card changes, so hosts don't serve a cached copy. */
export const SCHEDULE_CARD_URI = 'ui://cracked-ice/schedule-card-v1.html';
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

function read(...segments: string[]): string {
  // Functions run from the repo root; the api tests from api/.
  const candidates = [join(process.cwd(), ...segments), join(process.cwd(), '..', ...segments)];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Missing ${segments.join('/')}`);
  return readFileSync(found, 'utf8');
}

let cached: string | null = null;

/** The card's HTML with the site's wordmark inlined, recoloured by theme (CRACKED ink, ICE cyan). */
export function scheduleCardHtml(): string {
  if (cached) return cached;
  const wordmark = read('web', 'public', 'logo-horizontal.svg')
    // Size it with CSS: drop the fixed width/height on the root <svg> only.
    .replace(/<svg[^>]*>/, (tag) => tag.replace(/\s(width|height)="\d+"/g, ''))
    .replace('fill="#f3fbff"', 'style="fill:var(--wordmark-ink)"')
    .replace('fill="#63e6ff"', 'style="fill:var(--wordmark-ice)"');
  cached = read('api', '_lib', 'schedule-card.html').replace('__WORDMARK__', wordmark);
  return cached;
}

/**
 * The card's resource _meta. The card loads nothing from anywhere (no scripts, styles, fonts,
 * images or requests), so its allowlists are empty. Declared twice from these lists: the MCP Apps
 * standard (ui.csp) and ChatGPT's own keys, since ChatGPT reads the policy only from
 * openai/widgetCSP and otherwise runs the card with no policy (the "CSP off" badge).
 */
export function scheduleCardResourceMeta(site: string) {
  const connectDomains: string[] = [];
  const resourceDomains: string[] = [];
  return {
    ui: { prefersBorder: true, domain: site, csp: { connectDomains, resourceDomains } },
    'openai/widgetCSP': { connect_domains: connectDomains, resource_domains: resourceDomains },
    'openai/widgetPrefersBorder': true,
    'openai/widgetDomain': site,
  };
}

/** Tool _meta linking a tool to the card (the MCP Apps key, plus ChatGPT's alias). */
export function scheduleCardToolMeta(invoking: string, invoked: string) {
  return {
    ui: { resourceUri: SCHEDULE_CARD_URI },
    'openai/outputTemplate': SCHEDULE_CARD_URI,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
  };
}
