// src/pages/GofeelerSplitView.js
import React, { useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import GofeelerListPanel from '../components/GofeelerListPanel';
import TaskDetailContent from '../components/TaskDetailContent';
import CreateOrderForm from '../components/CreateOrderForm';
import useIsMobile from '../hooks/useIsMobile';

const MIN_SPLIT = 20;
const MAX_SPLIT = 60;

// The Gofeeler landing page — a master-detail split view (converted
// from gofeeler_landing_page_split_view_v1.html, resizer added from
// gofeeler_landing_page_split_view_resizable.html). Desktop: list stays
// a sidebar once something's open, detail/create fills the rest, and
// the divider between them is draggable (20-60% bounds, matching the
// mockup). Mobile: opening something replaces the list entirely, no
// resizer; "← Back" returns to it. Panel is derived from the URL
// (/, /task/:id, /create) rather than local-only state, so links stay
// shareable and browser back/forward works — the mockup's demo used
// local state instead, but a real app needs addressable routes.
const GofeelerSplitView = () => {
  const { pathname } = useLocation();
  const { id } = useParams();
  const isMobile = useIsMobile();

  const [splitRatio, setSplitRatio] = useState(50);
  const containerRef = useRef(null);

  const panel = pathname === '/' ? 'list' : pathname.startsWith('/task/') ? 'detail' : 'create';
  const splitOpen = panel !== 'list' && !isMobile;
  const listWidth = panel === 'list' ? '100%' : isMobile ? '0' : `${splitRatio}%`;
  const rightPanelFlex = panel === 'list' ? '0 0 0px' : splitOpen ? `0 0 ${100 - splitRatio}%` : '1 1 0%';

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
        margin: 'var(--mv-space-3)',
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
          borderRight: panel === 'list' || splitOpen ? 'none' : '0.5px solid var(--mv-border)',
          transition: 'width 0.2s ease',
        }}
      >
        <GofeelerListPanel selectedId={panel === 'detail' ? id : undefined} />
      </div>

      {splitOpen && (
        <div
          onMouseDown={handleResizeStart}
          title="Drag to resize"
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
          flex: rightPanelFlex,
          overflow: panel === 'list' ? 'hidden' : 'auto',
          transition: 'flex-basis 0.2s ease',
        }}
      >
        {panel !== 'list' && (
          <div style={{ padding: '16px 18px', minWidth: isMobile ? 'auto' : 280 }}>
            <Link
              to="/"
              style={{ color: 'var(--mv-color-primary)', fontSize: 12, textDecoration: 'none' }}
            >
              ← Back
            </Link>

            {panel === 'detail' && <TaskDetailContent id={id} />}

            {panel === 'create' && (
              <>
                <p
                  style={{
                    color: 'var(--mv-text-muted)',
                    fontSize: 12,
                    margin: '14px 0 4px',
                  }}
                >
                  Gofeeler · New order
                </p>
                <p
                  style={{
                    color: 'var(--mv-text)',
                    fontSize: 16,
                    fontWeight: 500,
                    margin: '0 0 18px',
                  }}
                >
                  Create sentiment analysis order
                </p>
                <CreateOrderForm />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GofeelerSplitView;
