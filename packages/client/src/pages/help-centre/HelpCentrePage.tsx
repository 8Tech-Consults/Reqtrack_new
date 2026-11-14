import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react';
import { ChevronDown, Search, Settings, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import clsx from 'clsx';
import { Container } from '@/components/container';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions';
import { HelpText } from '@/components/help-assistant/HelpText';
import { HelpAssistantChat } from '@/components/help-assistant/HelpAssistantChat';
import {
  GET_HELP_ARTICLE,
  GET_HELP_ARTICLES,
  GET_HELP_CATEGORIES,
  HelpArticle,
  HelpCategory,
  RATE_HELP_ARTICLE
} from '@/gql/helpCentre';

const useDebouncedValue = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

const HelpCentrePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedArticleId = searchParams.get('article');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(linkedArticleId);
  const [ratedArticleIds, setRatedArticleIds] = useState<Set<string>>(new Set());
  const articleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { auth } = useAuthContext();
  const canManage = Boolean(getPermissionsFromToken(auth?.access_token).can_manage_help_centre);

  const { data: categoryData } = useQuery<{ helpCategories: HelpCategory[] }>(GET_HELP_CATEGORIES);
  const { data: articleData, loading } = useQuery<
    { helpArticles: HelpArticle[] },
    { search?: string; categoryId?: string | null }
  >(GET_HELP_ARTICLES, {
    variables: { search: debouncedSearch || undefined, categoryId },
    fetchPolicy: 'cache-and-network'
  });
  // Fetching a single article records a view.
  const [recordView] = useLazyQuery(GET_HELP_ARTICLE, { fetchPolicy: 'network-only' });
  const [rateArticle] = useMutation(RATE_HELP_ARTICLE);

  const categories = (categoryData?.helpCategories || []).filter((category) => category.articleCount > 0);
  const articles = articleData?.helpArticles || [];

  // Group by category when browsing; keep relevance order when searching.
  const groups = useMemo(() => {
    if (debouncedSearch) return [{ name: `Results for “${debouncedSearch}”`, articles }];
    const byCategory = new Map<string, HelpArticle[]>();
    for (const article of articles) {
      const name = article.categoryName || 'Other';
      if (!byCategory.has(name)) byCategory.set(name, []);
      byCategory.get(name)!.push(article);
    }
    return Array.from(byCategory, ([name, items]) => ({ name, articles: items }));
  }, [articles, debouncedSearch]);

  // Deep link from the assistant: /help?article=12 opens and scrolls to it.
  useEffect(() => {
    if (!linkedArticleId) return;
    setSearch('');
    setCategoryId(null);
    setOpenArticleId(linkedArticleId);
    void recordView({ variables: { id: linkedArticleId } });
  }, [linkedArticleId, recordView]);

  useEffect(() => {
    if (!linkedArticleId || !articles.length) return;
    const element = articleRefs.current[linkedArticleId];
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [linkedArticleId, articles.length]);

  const toggleArticle = (id: string) => {
    const next = openArticleId === id ? null : id;
    setOpenArticleId(next);
    if (next) void recordView({ variables: { id: next } });
    if (linkedArticleId) setSearchParams({}, { replace: true });
  };

  const handleRate = (id: string, helpful: boolean) => {
    if (ratedArticleIds.has(id)) return;
    setRatedArticleIds((current) => new Set(current).add(id));
    rateArticle({ variables: { id, helpful } }).catch(() => undefined);
  };

  return (
    <Container>
      <div className="grid gap-5 py-4 sm:py-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-6">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">How can we help?</h2>
                <p className="text-sm text-slate-500">Search the Help Centre or ask the assistant.</p>
              </div>
              {canManage && (
                <Link to="/settings/help-centre" className="btn btn-sm btn-light shrink-0 gap-1.5">
                  <Settings size={14} /> Manage
                </Link>
              )}
            </div>

            <div className="relative mt-4">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="e.g. submit a requisition, reset password"
                className="input h-11 w-full pl-9"
                aria-label="Search help articles"
              />
            </div>

            {!debouncedSearch && categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryId(null)}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    !categoryId ? 'border-[#2aaed3] bg-[#2aaed3] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}
                    className={clsx(
                      'rounded-full border px-3 py-1 text-xs font-medium',
                      categoryId === category.id
                        ? 'border-[#2aaed3] bg-[#2aaed3] text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {category.name} <span className="opacity-70">({category.articleCount})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && !articles.length ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : !articles.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No articles found.</p>
              <p className="mt-1 text-xs text-slate-500">Try different words, or ask the assistant on the right.</p>
              {search && (
                <button type="button" className="btn btn-sm btn-light mt-3 gap-1" onClick={() => setSearch('')}>
                  <X size={14} /> Clear search
                </button>
              )}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.name} className="space-y-2">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</h3>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {group.articles.map((article) => {
                    const isOpen = openArticleId === article.id;
                    return (
                      <div
                        key={article.id}
                        ref={(element) => {
                          articleRefs.current[article.id] = element;
                        }}
                        className={clsx(isOpen && 'bg-slate-50/60')}
                      >
                        <button
                          type="button"
                          onClick={() => toggleArticle(article.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="text-sm font-medium text-slate-900">{article.question}</span>
                          <ChevronDown
                            size={16}
                            className={clsx('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
                          />
                        </button>
                        {isOpen && (
                          <div className="space-y-3 px-4 pb-4">
                            <HelpText text={article.answer} />
                            <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
                              {ratedArticleIds.has(article.id) ? (
                                <span>Thanks for your feedback.</span>
                              ) : (
                                <>
                                  <span>Was this helpful?</span>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-light gap-1"
                                    onClick={() => handleRate(article.id, true)}
                                  >
                                    <ThumbsUp size={12} /> Yes
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-light gap-1"
                                    onClick={() => handleRate(article.id, false)}
                                  >
                                    <ThumbsDown size={12} /> No
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex h-[600px] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-[#172550] px-4 py-3 text-white">
              <p className="text-sm font-semibold">Ask the assistant</p>
              <p className="text-[11px] text-white/70">Answers come from the Help Centre articles</p>
            </div>
            <HelpAssistantChat className="flex-1" />
          </div>
        </aside>
      </div>
    </Container>
  );
};

export default HelpCentrePage;
