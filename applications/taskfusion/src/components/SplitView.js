import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIsMobile from '../hooks/useIsMobile';

const MIN_SPLIT = 20;
const MAX_SPLIT = 60;

// Resizable master-detail shell — the list/resizer/detail mechanics
// GofeelerSplitView.js pioneered, generalized so the Project Hub and
// Admin pages (both list+detail, both now with a tabs dimension on
// top) don't hand-roll a third/fourth copy. GofeelerSplitView itself
// stays as-is for now (its panel selection is URL-driven, one more
// axis than this needs) — reconciling the two is future cleanup, not
// blocking here.
//
// `open` controls list-only vs split; `listPanel`/`detailPanel` are
// the content for each side. Desktop-only resizing (matches the
// mockups' resizer, disabled on mobile where the list disappears
// entirely instead of shrinking to a sliver).
const SplitView = ({ open, listPanel, detailPanel }) => {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const [splitRatio, setSplitRatio] = useState(50);
  const containerRef = useRef(null);

  const splitOpen = open && !isMobile;
  const listWidth = !open ? '100%' : isMobile ? '0' : `${splitRatio}%`;
  const detailFlex = !open ? '0 0 0px' : splitOpen ? `0 0 ${100 - splitRatio}%` : '1 1 0%';

  const handleResizeStart = (e) => {
    if (!splitOpen || !containerRef.current) return;
    e.preventDefault();
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const startX = e.clientX;
    const startRatio = splitRatio;

    const onMove = (moveEvent) => {
      const deltaPct = ((moveEvent.clientX - startX) / containerWidth) * 100;
      setSplitRatio(Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, startRatio + deltaPct)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        maxWidth: '100%',
        height: 'calc(100vh - 120px)',
        minHeight: 300,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: listWidth,
          flex: 'none',
          overflow: 'hidden',
          borderRight: !open || splitOpen ? 'none' : '0.5px solid var(--mv-border)',
          transition: 'width 0.2s ease',
        }}
      >
        {listPanel}
      </div>

      {splitOpen && (
        <div
          onMouseDown={handleResizeStart}
          title={t('dragToResize')}
          style={{
            width: 6,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'var(--mv-border)',
          }}
        />
      )}

      <div
        style={{
          flex: detailFlex,
          overflow: open ? 'auto' : 'hidden',
          transition: 'flex-basis 0.2s ease',
        }}
      >
        {open && <div style={{ padding: '16px 18px', minWidth: isMobile ? 'auto' : 280 }}>{detailPanel}</div>}
      </div>
    </div>
  );
};

export default SplitView;
