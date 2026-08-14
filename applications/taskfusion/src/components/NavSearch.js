// src/components/NavSearch.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import useClickOutside from '../hooks/useClickOutside';

const DEBOUNCE_MS = 250;
const SUGGEST_SIZE = 5;

// Global navbar search (6.5) — as-you-type suggest via 6.4's
// permission-scoped GET /api/search, reusing that endpoint directly
// with a small `size` rather than a dedicated suggest route (there's
// no lighter-weight shape to ask for; the endpoint already returns
// task_id/title/snippet/service/score). Debounce pattern mirrors
// TagInput's own hand-rolled combobox — this repo has no downshift
// dependency despite the roadmap doc's "downshift/combobox pattern"
// phrasing, so "reuse the pattern" means reuse this shape, not the
// library.
const NavSearch = () => {
  const { t } = useTranslation('search');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const closeSearch = () => {
    setOpen(false);
    setQuery('');
    setMatches([]);
  };
  useClickOutside(wrapRef, closeSearch);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&size=${SUGGEST_SIZE}`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((data) => setMatches(data.hits || []))
        .catch(() => setMatches([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const goToResults = (q) => {
    closeSearch();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeSearch();
    } else if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      goToResults(query.trim());
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label={t('navSearch.ariaLabel')}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          display: 'flex',
          cursor: 'pointer',
          color: 'var(--mv-text-muted)',
        }}
      >
        <IconSearch size={16} />
      </button>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('navSearch.placeholder')}
        style={{
          width: open ? 170 : 0,
          opacity: open ? 1 : 0,
          marginLeft: open ? 8 : 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 13,
          color: 'var(--mv-text)',
          transition: 'width .18s ease, opacity .12s ease, margin .18s ease',
          padding: 0,
        }}
      />

      {open && query.trim() && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 290,
            background: 'var(--mv-bg-elevated)',
            border: '0.5px solid var(--mv-border)',
            borderRadius: 10,
            boxShadow: 'var(--mv-shadow)',
            overflow: 'hidden',
            zIndex: 20,
          }}
        >
          {matches.length === 0 ? (
            <div style={{ padding: '14px', fontSize: 12, color: 'var(--mv-text-muted)', textAlign: 'center' }}>
              {t('navSearch.empty', { query: query.trim() })}
            </div>
          ) : (
            matches.map((hit) => (
              <div
                key={hit.task_id}
                onClick={() => {
                  closeSearch();
                  navigate(`/task/${hit.task_id}`);
                }}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom: '0.5px solid var(--mv-border)',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--mv-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hit.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--mv-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hit.service}
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => goToResults(query.trim())}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              padding: 10,
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--mv-color-primary)',
              background: 'none',
              border: 'none',
              borderTop: matches.length > 0 ? '0.5px solid var(--mv-border)' : 'none',
              cursor: 'pointer',
            }}
          >
            {t('navSearch.viewAll', { query: query.trim() })}
          </button>
        </div>
      )}
    </div>
  );
};

export default NavSearch;
