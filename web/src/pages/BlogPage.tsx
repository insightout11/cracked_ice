import { Link } from 'react-router-dom';
import posts from '../generated/blog-posts.json';

export function BlogPage() {
  return (
    <main className="min-h-screen bg-[var(--surface-0)] [background:linear-gradient(135deg,_var(--surface-0)_0%,_var(--surface-2)_100%)]">
      <div className="blog-page-frame py-10">
        <div>
          <header className="mb-12 text-center">
            <p className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-accent">Schedule-aware strategy</p>
            <h1 className="mb-4 text-4xl font-bold text-ink">Cracked Ice Blog</h1>
            <p className="mx-auto max-w-2xl text-lg text-ink-dim">
              Original fantasy hockey schedule analysis, draft strategy, and lineup decisions.
            </p>
          </header>

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface-2/40 py-16 text-center text-ink-dim">
              No articles published yet. Check back soon.
            </div>
          ) : (
            <div className="grid gap-8">
              {posts.map((article) => (
                <article key={article.id} className="overflow-hidden rounded-2xl border border-line bg-surface-2/40 backdrop-blur-sm transition hover:border-accent hover:shadow-[0_0_30px_var(--accent-muted)]">
                  {article.imageUrl && <img src={article.imageUrl} alt="" className="h-52 w-full object-cover" loading="lazy" />}
                  <div className="p-6 sm:p-8">
                    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-dim">
                      <time dateTime={article.publishDate}>{new Date(`${article.publishDate}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                      <span aria-hidden="true">·</span>
                      <span>{article.readTimeMinutes} min read</span>
                    </div>
                    <h2 className="mb-3 text-2xl font-bold text-ink">{article.title}</h2>
                    <p className="mb-6 leading-relaxed text-ink-dim">{article.excerpt}</p>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {article.tags.map((tag) => <span key={tag} className="rounded-full border border-line bg-surface-1 px-3 py-1 text-xs text-ink-dim">#{tag}</span>)}
                      </div>
                      <Link to={`/blog/${article.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-accent bg-accent-muted px-6 font-medium text-accent transition hover:bg-accent hover:text-surface-0">
                        Read article
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
