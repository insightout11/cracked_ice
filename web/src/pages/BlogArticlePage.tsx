import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { SupportBlock } from '../components/SupportBlock';
import posts from '../generated/blog-posts.json';
import { track } from '../lib/analytics';

export function BlogArticlePage() {
  const { id } = useParams<{ id: string }>();
  const article = posts.find((post) => post.id === id);

  if (!article) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-surface-0 px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-3 text-3xl font-bold text-ink">Article not found</h1>
          <p className="mb-6 text-ink-dim">This article may have moved or is not published.</p>
          <Link to="/blog" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent bg-accent-muted px-5 font-medium text-accent"><ArrowLeft size={16} /> Back to blog</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--surface-0)] [background:linear-gradient(135deg,_var(--surface-0)_0%,_var(--surface-2)_100%)]">
      <div className="blog-page-frame py-10">
        <div>
          <Link to="/blog" className="mb-8 inline-flex min-h-11 items-center gap-2 text-ink-dim transition hover:text-accent"><ArrowLeft size={16} /> Back to blog</Link>
          <header className="mb-8">
            {article.heroImage && <img src={article.heroImage} width={article.heroSize?.width} height={article.heroSize?.height} alt="" className="mb-8 max-h-[28rem] w-full rounded-2xl object-cover" fetchPriority="high" />}
            <div className="mb-5 flex flex-wrap gap-3 text-sm text-ink-dim">
              {article.publishDate && <time dateTime={article.publishDate}>{new Date(`${article.publishDate}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>}
              {article.publishDate && <span aria-hidden="true">·</span>}<span>{article.readTimeMinutes} min read</span><span aria-hidden="true">·</span><Link to="/methodology#author" className="hover:text-accent">{article.author}</Link>
            </div>
            <h1 className="mb-5 text-3xl font-bold leading-tight text-ink md:text-5xl">{article.title}</h1>
            <p className="mb-5 text-lg leading-relaxed text-ink-dim">{article.excerpt}</p>
            <div className="flex flex-wrap gap-2">{article.tags.map((tag) => <span key={tag} className="rounded-full border border-line bg-surface-1 px-3 py-1 text-sm text-ink-dim">#{tag}</span>)}</div>
          </header>

          <article className="article-content rounded-2xl border border-line bg-surface-2/40 p-6 text-ink-dim backdrop-blur-sm sm:p-10" dangerouslySetInnerHTML={{ __html: article.html }} />

          <nav aria-label="Related fantasy hockey tools" className="mt-8 rounded-2xl border border-line bg-surface-1 p-6">
            <h2 className="text-lg font-semibold text-ink">Use the schedule in your league</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">Turn the article’s strategy into a league-scored decision with current 2026–27 data.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/optimizer" onClick={() => track('article_tool_click', { article_id: article.id, destination: 'optimizer' })} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent">Open the schedule optimizer</Link>
              <Link to="/compare" onClick={() => track('article_tool_click', { article_id: article.id, destination: 'compare' })} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent">Compare players</Link>
              <Link to="/season" onClick={() => track('article_tool_click', { article_id: article.id, destination: 'season' })} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent">Explore the season</Link>
            </div>
          </nav>

          {article.related.length > 0 && (
            <nav aria-labelledby="related-reading" className="mt-8">
              <h2 id="related-reading" className="text-lg font-semibold text-ink">Keep reading</h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-3">
                {article.related.map((related) => (
                  <li key={related.id}>
                    <Link to={`/blog/${related.id}`} onClick={() => track('article_related_click', { article_id: article.id, destination: related.id })} className="block h-full rounded-xl border border-line bg-surface-1 p-4 transition hover:border-accent">
                      <span className="block font-semibold text-ink">{related.title}</span>
                      <span className="mt-2 block text-sm leading-relaxed text-ink-dim">{related.excerpt}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <SupportBlock className="mt-10" />
        </div>
      </div>
    </main>
  );
}
