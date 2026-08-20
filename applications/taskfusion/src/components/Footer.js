// src/components/Footer.js
//
// The Microverse site footer — not blog-specific, even though the blog
// pages are its only callers today (full mock-up markup,
// microverse_blog_landing_v4.html). Company/Resources columns and the
// social icons stay static (plain text/icons, not real hrefs): none of
// those destination pages exist in this app yet (no /about, /roadmap,
// /docs, /status, /contact route, no real social URLs), so rendering
// them as live links would just be dead ones. Services links are real,
// though — each domain service already has its own subdomain microsite
// (ServiceLandingPage.js), so those go through the same
// hostUrlForSubdomain() helper Navbar/the dashboard's ServiceCard
// already use rather than hardcoding a host.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconBrandGithub, IconBrandX, IconBrandLinkedin } from '@tabler/icons-react';
import { hostUrlForSubdomain } from '../services/keycloak';

const footerLinkStyle = { color: 'var(--mv-text-muted)', fontSize: 13, display: 'block', marginBottom: 8 };
const footerColumnTitleStyle = { color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: '0 0 12px' };

// Same representative subset the mock-up shows — not every domain
// service (elixtempo/rustledger/rubykudos also have subdomains, but
// aren't customer-facing products in the way these 4 are).
const FOOTER_SERVICES = [
  { name: 'Gofeeler', subdomain: 'gofeeler' },
  { name: 'SpringPix', subdomain: 'springpix' },
  { name: 'PyReel', subdomain: 'pyreel' },
  { name: 'Djaboard', subdomain: 'djaboard' },
];

const Footer = () => {
  const { t } = useTranslation('blog');
  return (
    <div style={{ borderTop: '0.5px solid var(--mv-border)', marginTop: 40 }}>
      <style>{`
        @media (max-width: 640px) {
          .mv-footer-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
        }
      `}</style>
      <div
        className="mv-footer-grid"
        style={{
          maxWidth: 1140,
          margin: '0 auto',
          padding: '32px 24px 24px',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mv-color-primary)' }} />
            <span style={{ color: 'var(--mv-text)', fontWeight: 500, fontSize: 14 }}>Microverse</span>
          </div>
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, margin: '0 0 14px', maxWidth: 260, lineHeight: 1.5 }}>
            {t('list.footer.tagline')}
          </p>
          <div style={{ display: 'flex', gap: 14, color: 'var(--mv-text-muted)' }}>
            <IconBrandGithub size={18} aria-hidden="true" />
            <IconBrandX size={18} aria-hidden="true" />
            <IconBrandLinkedin size={18} aria-hidden="true" />
          </div>
        </div>

        <div>
          <p style={footerColumnTitleStyle}>{t('list.footer.servicesTitle')}</p>
          {FOOTER_SERVICES.map((service) => (
            <a key={service.subdomain} href={hostUrlForSubdomain(service.subdomain)} style={footerLinkStyle}>
              {service.name}
            </a>
          ))}
        </div>

        <div>
          <p style={footerColumnTitleStyle}>{t('list.footer.companyTitle')}</p>
          <span style={footerLinkStyle}>{t('list.footer.companyAbout')}</span>
          <span style={footerLinkStyle}>{t('list.headerTitle')}</span>
          <span style={footerLinkStyle}>{t('list.footer.companyRoadmap')}</span>
        </div>

        <div>
          <p style={footerColumnTitleStyle}>{t('list.footer.resourcesTitle')}</p>
          <span style={footerLinkStyle}>{t('list.footer.resourcesDocs')}</span>
          <span style={footerLinkStyle}>{t('list.footer.resourcesStatus')}</span>
          <span style={footerLinkStyle}>{t('list.footer.resourcesContact')}</span>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid var(--mv-border)' }}>
        <div
          style={{
            maxWidth: 1140,
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>
            {t('list.footer.copyright', { year: new Date().getFullYear() })}
          </span>
          <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>
            {t('list.footer.privacy')} · {t('list.footer.terms')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Footer;
