import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconX } from '@tabler/icons-react';
import { hostUrlForSubdomain } from '../services/keycloak';

// Closes back to the Gofeeler landing page. A real cross-origin anchor,
// not a router Link — these forms can be reached from either the
// platform host or the gofeeler microsite itself.
const CloseButton = () => {
  const { t } = useTranslation('common');
  return (
  <a
    href={`${hostUrlForSubdomain('gofeeler')}/`}
    aria-label={t('close')}
    style={{
      position: 'absolute',
      top: 14,
      right: 14,
      color: 'var(--mv-text-muted)',
      display: 'flex',
      cursor: 'pointer',
    }}
  >
    <IconX size={18} />
  </a>
  );
};

export default CloseButton;
