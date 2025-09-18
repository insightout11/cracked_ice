import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface BlogArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  publishDate: string;
  readTimeMinutes: number;
  tags: string[];
  imageUrl?: string;
}

export function BlogPage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const articles: BlogArticle[] = [
      {
        id: 'position-group-stacks-2025',
        title: 'Best Position Group Stacks for Fantasy Hockey 2025-26',
        excerpt: 'Stop benching good players and start weaponizing the NHL schedule. Learn the mathematical strategy that separates winners from those who draft with feelings.',
        content: 'Full article content will be loaded here...',
        publishDate: '2025-01-15',
        readTimeMinutes: 8,
        tags: ['strategy', 'draft', 'position-stacks', 'advanced'],
        imageUrl: '/blog-images/position-stacks-hero.jpg'
      },
      {
        id: '1',
        title: 'Welcome to the Cracked Ice Blog',
        excerpt: 'Introduction to our new blog section covering fantasy hockey insights, strategies, and analysis.',
        content: 'Full article content will be loaded here...',
        publishDate: '2024-01-15',
        readTimeMinutes: 3,
        tags: ['announcement', 'welcome']
      }
    ];

    setArticles(articles);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen ice-rink-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[var(--ci-white)]">Loading articles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ice-rink-bg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-[var(--ci-white)] mb-4">
              Cracked Ice Blog
            </h1>
            <p className="text-lg text-[var(--ci-muted)] max-w-2xl mx-auto">
              Fantasy hockey insights, strategies, and analysis to help you dominate your league
            </p>
          </div>

          {articles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--ci-muted)] text-lg">No articles published yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid gap-8 md:gap-12">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="bg-[var(--ice-card-strong)] rounded-2xl border border-[var(--glass-border)] p-8 hover:border-[var(--laser-cyan)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(94,245,255,0.15)]"
                >
                  {article.imageUrl && (
                    <div className="mb-6">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-48 object-cover rounded-xl"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4 mb-4 text-sm text-[var(--ci-muted)]">
                    <time dateTime={article.publishDate}>
                      {new Date(article.publishDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                    <span>•</span>
                    <span>{article.readTimeMinutes} min read</span>
                  </div>

                  <h2 className="text-2xl font-bold text-[var(--ci-white)] mb-4 hover:text-[var(--laser-cyan)] transition-colors">
                    {article.title}
                  </h2>

                  <p className="text-[var(--ci-muted)] mb-6 leading-relaxed">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-[var(--glass-fill)] border border-[var(--glass-border)] rounded-full text-xs text-[var(--ci-muted)] hover:text-[var(--laser-cyan)] hover:border-[var(--laser-cyan)] transition-colors"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <Link
                      to={`/blog/${article.id}`}
                      className="px-6 py-2 bg-[var(--glass-fill-active)] border border-[var(--laser-cyan)] text-[var(--laser-cyan)] rounded-lg hover:bg-[var(--laser-cyan)] hover:text-[var(--ice-card-strong)] transition-all duration-200 font-medium inline-block"
                    >
                      Read More
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}