import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { pageMeta } from '../lib/pageMeta';

/** How the numbers are made. The text lives in web/src/seo/pages.json, shared with the prerendered page. */
export function MethodologyPage() {
  const meta = pageMeta('/methodology');
  return (
    <>
      <main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        <article className="rounded-xl border border-line bg-surface-glass p-6 shadow-panel sm:p-9">
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-accent">{meta.eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">{meta.heading}</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-dim">{meta.description}</p>
          <div className="prose-legal mt-8 space-y-7 text-sm leading-relaxed text-ink-dim">
            {(meta.sections ?? []).map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
            <section>
              <h2>Questions or corrections</h2>
              <p>Spotted a number that looks wrong? <Link to="/contact">Get in touch</Link>. Every report gets checked against the source data.</p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
