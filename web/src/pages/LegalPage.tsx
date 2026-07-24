import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';

const UPDATED = 'July 24, 2026';

function PageShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <><main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"><article className="rounded-xl border border-line bg-surface-glass p-6 shadow-panel sm:p-9"><p className="font-display text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p><h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-ink-mute">Last updated {UPDATED}</p><div className="prose-legal mt-8 space-y-7 text-sm leading-relaxed text-ink-dim">{children}</div></article></main><Footer /></>;
}

export function PrivacyPage() {
  return <PageShell eyebrow="Your data" title="Privacy Policy">
    <section><h2>What Cracked Ice stores</h2><p>Guests can use core tools without an account. League settings, rosters, draft state, and preferences may be stored in the browser on the device you use. If you create an account, your email address and League Workspace may be stored through Supabase so they can sync across devices.</p></section>
    <section><h2>Connected fantasy providers</h2><p>Provider connections, including the planned Yahoo Fantasy integration, are optional. When enabled, Cracked Ice will request only the access described during authorization. Provider credentials are encrypted and kept server-side; they are not placed in browser storage. The initial Yahoo integration is read-only.</p></section>
    <section><h2>Imports and screenshots</h2><p>Roster text and free-agent screenshots are processed only to perform the requested import. Users should avoid uploading unrelated personal information. Images are not intended to become a permanent public record.</p></section>
    <section><h2>Operations and analytics</h2><p>Vercel hosts the application and Supabase provides account and database services. These providers may process technical information needed to operate and secure the service. Limited usage analytics may be collected when enabled; Cracked Ice respects browser Do Not Track for its own page-view event.</p></section>
    <section><h2>Control and retention</h2><p>You can use Cracked Ice without connecting a fantasy provider, disconnect a provider, sign out, or clear locally stored workspace data through your browser. Provider disconnection removes locally retained credentials while preserving manual workspace data where practical.</p></section>
    <section><h2>Questions</h2><p>Use the options on the <Link to="/contact">Contact page</Link> for support or privacy questions. Do not include passwords, access tokens, or private league data in a public support request.</p></section>
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
    <section><h2>Product support</h2><p>For reproducible bugs or feature feedback, use the public <a href="https://github.com/insightout11/cracked_ice/issues" target="_blank" rel="noreferrer">Cracked Ice issue tracker</a>. Include the affected page, browser, and steps to reproduce—but never include passwords, OAuth codes, tokens, screenshots containing private league information, or other sensitive data.</p></section>
    <section><h2>Account and privacy requests</h2><p>Do not post account or privacy details publicly. Until a private support mailbox is published, retain the email address used for your Cracked Ice account and reference this policy when contacting the operator through the channel that directed you to the service.</p></section>
    <section><h2>Security</h2><p>Do not test vulnerabilities against production or publish exploit details. Provide a minimal, non-sensitive description through the project support channel so a private reporting path can be arranged.</p></section>
  </PageShell>;
}
