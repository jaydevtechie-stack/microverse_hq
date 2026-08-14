// src/pages/SearchResultsPage.js
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import usePageMeta from '../hooks/usePageMeta';

const PAGE_SIZE = 10;

// Search results page (6.6) — same scoped GET /api/search endpoint as
// the navbar's suggest dropdown (6.5) and 6.4 itself, just with a full
// page size and pagination instead of a 5-hit preview. First page in
// the app needing real page-through UI (no existing pattern to copy —
// GofeelerListPanel/AdminUsersPage both fetch unpaginated lists), so
// Prev/Next here is new, driven by the endpoint's own page/size/total.
const SearchResultsPage = () => {
  const { t } = useTranslation('search');
  usePageMeta({ title: 'Microverse - Search' });
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(urlQuery);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null); // { hits, total, page, size }
  const [error, setError] = useState(null);

  // Keep the input in sync if the URL's ?q= changes from elsewhere
  // (e.g. the navbar's "view all" link) rather than this page's own form.
  useEffect(() => {
    setInputValue(urlQuery);
    setPage(1);
  }, [urlQuery]);

  useEffect(() => {
    if (!urlQuery.trim()) {
      setResult(null);
      setError(null);
      return;
    }
    const params = new URLSearchParams({
      q: urlQuery,
      page: String(page),
      size: String(PAGE_SIZE),
    });

    fetch(`/api/search?${params.toString()}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`search-service returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setResult(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [urlQuery, page]);

  const submitQuery = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) setSearchParams({ q: trimmed });
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.size)) : 1;

  return (
    <div
      style={{
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        padding: '18px 20px',
      }}
    >
      <form
        onSubmit={submitQuery}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 999,
          padding: '10px 16px',
          marginBottom: 16,
        }}
      >
        <IconSearch size={16} color="var(--mv-text-muted)" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('resultsPage.placeholder')}
          style={{
            flex: 1,
            border: 'none',
            background: 'none',
            outline: 'none',
            fontSize: 14,
            color: 'var(--mv-text)',
            minWidth: 0,
          }}
        />
      </form>

      {!urlQuery.trim() && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>{t('resultsPage.prompt')}</p>
      )}

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>
          {t('resultsPage.loadError', { error })}
        </p>
      )}

      {urlQuery.trim() && !error && result && (
        <>
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 12px' }}>
            {t(`resultsPage.count_${result.total === 1 ? 'one' : result.total === 0 ? 'zero' : 'other'}`, {
              count: result.total,
              query: urlQuery,
            })}
          </p>

          {result.hits.length === 0 ? (
            <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
              {t('resultsPage.empty', { query: urlQuery })}
            </p>
          ) : (
            <div>
              {result.hits.map((hit) => (
                <Link
                  key={hit.task_id}
                  to={`/task/${hit.task_id}`}
                  style={{
                    display: 'block',
                    padding: '14px 4px',
                    borderBottom: '0.5px solid var(--mv-border)',
                    textDecoration: 'none',
                  }}
                >
                  <p style={{ color: 'var(--mv-text)', fontSize: 14, fontWeight: 600, margin: '0 0 3px' }}>
                    {hit.title}
                  </p>
                  {hit.snippet && (
                    <p
                      style={{
                        color: 'var(--mv-text-muted)',
                        fontSize: 12.5,
                        margin: '0 0 3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hit.snippet}
                    </p>
                  )}
                  <p style={{ color: 'var(--mv-text-faint, var(--mv-text-muted))', fontSize: 11, margin: 0 }}>
                    {hit.service}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {result.total > result.size && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--mv-radius)',
                  border: '0.5px solid var(--mv-border)',
                  background: 'transparent',
                  color: page <= 1 ? 'var(--mv-text-muted)' : 'var(--mv-text)',
                  cursor: page <= 1 ? 'default' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                {t('resultsPage.prev')}
              </button>
              <span style={{ fontSize: 12, color: 'var(--mv-text-muted)' }}>
                {t('resultsPage.pageOf', { page, totalPages })}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--mv-radius)',
                  border: '0.5px solid var(--mv-border)',
                  background: 'transparent',
                  color: page >= totalPages ? 'var(--mv-text-muted)' : 'var(--mv-text)',
                  cursor: page >= totalPages ? 'default' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                {t('resultsPage.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResultsPage;
