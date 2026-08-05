// src/pages/GofeelerSplitView.js
import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import GofeelerListPanel from '../components/GofeelerListPanel';
import TaskDetailContent from '../components/TaskDetailContent';
import CreateOrderForm from '../components/CreateOrderForm';
import useIsMobile from '../hooks/useIsMobile';

// The Gofeeler landing page — a master-detail split view (converted
// from gofeeler_landing_page_split_view_v1.html). Desktop: list stays
// a sidebar once something's open, detail/create fills the rest.
// Mobile: opening something replaces the list entirely; "← Back"
// returns to it. Panel is derived from the URL (/, /task/:id, /create)
// rather than local-only state, so links stay shareable and browser
// back/forward works — the mockup's demo used local state instead,
// but a real app needs addressable routes.
const GofeelerSplitView = () => {
  const { pathname } = useLocation();
  const { id } = useParams();
  const isMobile = useIsMobile();

  const panel = pathname === '/' ? 'list' : pathname.startsWith('/task/') ? 'detail' : 'create';
  const listWidth = panel === 'list' ? '100%' : isMobile ? '0' : '280px';
  const rightPanelFlex = panel === 'list' ? '0 0 0px' : '1 1 0%';

  return (
    <div
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
          borderRight: panel === 'list' ? 'none' : '0.5px solid var(--mv-border)',
          transition: 'width 0.2s ease',
        }}
      >
        <GofeelerListPanel selectedId={panel === 'detail' ? id : undefined} />
      </div>

      <div
        style={{
          flex: rightPanelFlex,
          overflow: panel === 'list' ? 'hidden' : 'auto',
          transition: 'flex-basis 0.2s ease',
        }}
      >
        {panel !== 'list' && (
          <div style={{ padding: '16px 18px', minWidth: isMobile ? 'auto' : 400 }}>
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
