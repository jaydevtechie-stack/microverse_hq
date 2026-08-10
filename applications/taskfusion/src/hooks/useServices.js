import { useEffect, useState, useCallback } from 'react';
import { authHeaders } from '../services/keycloak';
import { SERVICE_THEME } from '../data/services';

const FALLBACK_THEME = {
  icon: null,
  illustration: () => null,
  dark: { fg: '#9BB8E0', bg: '#9BB8E022' },
  light: { fg: '#5F5E5A', bg: '#EDEDED' },
  subdomain: null,
  requiredRole: null,
};

// Fetches the real `services` table content (name/tech/title/
// description/status) and merges each row with its static presentation
// entry from data/services.js by `key` — Dashboard/AdminPage both
// render off the merged shape ServiceCard already expects. A key with
// no matching theme entry (a brand-new service an admin just added)
// still renders, with a generic fallback icon/color rather than
// crashing.
export default function useServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/services', { headers: { ...authHeaders() } });
      const rows = await res.json();
      if (!res.ok) throw new Error(rows.message || `task-service returned ${res.status}`);

      const merged = rows.map((row) => {
        const theme = SERVICE_THEME.find((s) => s.key === row.key) || FALLBACK_THEME;
        return { ...theme, ...row };
      });
      setServices(merged);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, refetch: fetchServices };
}
