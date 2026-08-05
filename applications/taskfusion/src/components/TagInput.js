import React, { useState } from 'react';
import { IconX } from '@tabler/icons-react';

// Structure/layout only for now — a plain case-insensitive substring
// filter over a hardcoded vocab. Branch 3.2 (ROADMAP.md) replaces this
// with search-service's Elasticsearch-backed fuzzy tag-suggest
// endpoint; this local filter is just a stand-in for that shape.
const TagInput = ({ vocab, selected, onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const query = inputValue.trim().toLowerCase();
  const matches = query
    ? vocab.filter((v) => !selected.includes(v) && v.toLowerCase().includes(query)).slice(0, 4)
    : [];
  const exactMatch = matches.some((m) => m.toLowerCase() === query);
  const showCreate = query.length > 1 && !exactMatch;

  const addTag = (tag) => {
    if (!selected.includes(tag)) onChange([...selected, tag]);
    setInputValue('');
  };

  const removeTag = (tag) => onChange(selected.filter((t) => t !== tag));

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a tag, e.g. 'urgency'..."
          style={{
            width: '100%',
            background: 'var(--mv-bg)',
            border: '0.5px solid var(--mv-border)',
            borderRadius: 8,
            padding: '9px 12px',
            color: 'var(--mv-text)',
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
        {(matches.length > 0 || showCreate) && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 10,
            }}
          >
            {matches.map((tag) => (
              <div
                key={tag}
                onClick={() => addTag(tag)}
                style={{ padding: '8px 12px', color: 'var(--mv-text)', fontSize: 13, cursor: 'pointer' }}
              >
                {tag}
              </div>
            ))}
            {showCreate && (
              <div
                onClick={() => addTag(inputValue.trim())}
                style={{
                  padding: '8px 12px',
                  color: 'var(--mv-color-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  borderTop: matches.length > 0 ? '0.5px solid var(--mv-border)' : 'none',
                }}
              >
                + Create "{inputValue.trim()}"
              </div>
            )}
          </div>
        )}
      </div>

      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 8px' }}>
        Fuzzy-matched against search-service's shared tag index — new tags are added automatically
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 28 }}>
        {selected.map((tag) => (
          <span
            key={tag}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              borderRadius: 14,
              background: 'color-mix(in srgb, var(--mv-color-primary) 13%, transparent)',
              color: 'var(--mv-color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tag}
            <IconX size={11} style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)} />
          </span>
        ))}
      </div>
    </div>
  );
};

export default TagInput;
