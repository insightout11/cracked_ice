import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';

const UPDATED = 'July 29, 2026';
const SUPPORT_EMAIL = 'support@crackedicehockey.com';

function PageShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <><main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"><article className="rounded-xl border border-line bg-surface-glass p-6 shadow-panel sm:p-9"><p className="font-display text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p><h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-ink-mute">Last updated {UPDATED}</p><div className="prose-legal mt-8 space-y-7 text-sm leading-relaxed text-ink-dim">{children}</div></article></main><Footer /></>;
}

export function PrivacyPage() {
  return <PageShell eyebrow="Your data" title="Privacy Policy">
    <section><h2>What Cracked Ice stores</h2><p>Guests can use core tools without an account. League settings, rosters, draft state, and preferences may be stored in the browser on the device you use. If you create an account, your email address and League Workspace may be stored through Supabase so they can sync across devices.</p></section>
    <section><h2>Connected fantasy providers</h2><p>Provider connections, including Yahoo Fantasy, are optional and require your express authorization. When enabled, Cracked Ice may retrieve the league and team information needed to provide its tools, such as league identity, scoring settings, roster and lineup slots, season and playoff dates, your roster and current lineup, player eligibility, transaction context where supported, and player availability status. This information is used only to populate your private League Workspace and provide league-specific fantasy-hockey analysis. The initial Yahoo integration is read-only.</p></section>
    <section><h2>Yahoo authorization and credentials</h2><p>Yahoo connections use OAuth 2.0. Cracked Ice requests only the permissions shown during authorization. Access and refresh credentials are encrypted and kept server-side; they are not placed in browser storage, analytics, or share images. Cracked Ice does not request your Yahoo password.</p></section>
    <section><h2>Imports and screenshots</h2><p>Roster text and free-agent screenshots are processed only to perform the requested import. Users should avoid uploading unrelated personal information. Images are not intended to become a permanent public record.</p></section>
    <section><h2>Operations and analytics</h2><p>Vercel hosts the application and Supabase provides account and database services. These providers may process technical information needed to operate and secure the service. Limited usage analytics may be collected when enabled; Cracked Ice respects browser Do Not Track for its own page-view event.</p></section>
    <section><h2>Control and retention</h2><p>You can use Cracked Ice without connecting a fantasy provider, disconnect a provider, sign out, or clear locally stored workspace data through your browser. Yahoo-sourced user data is cached only as needed for the requested service and is refreshed or deleted within 24 hours unless Yahoo expressly permits longer retention. Permitted provider identifiers and encrypted OAuth credentials may be retained while your connection remains active. Disconnecting Yahoo deletes the locally retained Yahoo credentials, stops future Yahoo retrieval, and removes Yahoo-sourced user data while preserving information you entered manually where practical. You may request deletion of your Cracked Ice account and associated cloud workspace data by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
    <section><h2>Questions</h2><p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or use the <Link to="/contact">Contact page</Link> for support, privacy, or deletion requests. Do not include passwords, access tokens, OAuth codes, or unnecessary private league data.</p></section>
  </PageShell>;
}

export function TermsPage() {
  return <PageShell eyebrow="Using Cracked Ice" title="Terms of Use">
    <section><h2>Decision-support service</h2><p>Cracked Ice provides fantasy-hockey analysis and planning tools. Projections, schedules, availability indicators, and recommendations are informational estimates—not guarantees of player performance, league outcomes, or provider availability.</p></section>
    <section><h2>Your responsibilities</h2><p>You are responsible for verifying league rules, lineup locks, player eligibility, transactions, and provider information before acting. Do not misuse the service, attempt to access another user’s information, interfere with operations, or upload content you are not authorized to process.</p></section>
    <section><h2>Third-party services</h2><p>NHL, Yahoo Fantasy, Fantrax, ESPN, and other names belong to their respective owners. Cracked Ice is an independent product and is not sponsored by or affiliated with those services. Third-party integrations remain subject to their own terms and availability.</p></section>
    <section><h2>Service changes</h2><p>Features and data sources may change, pause, or be withdrawn. Cracked Ice is provided on an “as available” basis to the extent permitted by law.</p></section>
    <section><h2>Questions</h2><p>See the <Link to="/contact">Contact page</Link> for support. Use of the service after material updates means you accept the updated terms.</p></section>
  </PageShell>;
}

export function ContactPage() {
  return <PageShell eyebrow="Support" title="Contact Cracked Ice">
    <section><h2>Product support</h2><p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for private support. For reproducible bugs or feature feedback that contains no private information, you may also use the public <a href="https://github.com/insightout11/cracked_ice/issues" target="_blank" rel="noreferrer">Cracked Ice issue tracker</a>. Include the affected page, browser, and steps to reproduce—but never publish passwords, OAuth codes, tokens, screenshots containing private league information, or other sensitive data.</p></section>
    <section><h2>Account and privacy requests</h2><p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to request access to or deletion of your Cracked Ice account and associated cloud workspace data, or for questions about connected-provider data. Send requests from the email address associated with your Cracked Ice account when possible. Do not post account or privacy details publicly.</p></section>
    <section><h2>Security</h2><p>Do not test vulnerabilities against production or publish exploit details. Email a minimal, non-sensitive description to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> so a private reporting path can be arranged.</p></section>
  </PageShell>;
}
