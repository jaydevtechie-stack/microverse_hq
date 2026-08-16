// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';  // Use Routes instead of Switch
import { renderToStaticMarkup } from 'react-dom/server';
import { initKeycloak, landingUrl } from './services/keycloak';
import { ThemeProvider } from './context/ThemeContext';
import { SERVICE_THEME } from './data/services';
import { setFavicon } from './utils/favicon';
import microverseLogo from './assets/brand/design-system/logos/microverse-logo.png';
import LandingPage from './pages/LandingPage';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';  // Example protected page
import AccountsViewPage from './pages/AccountsViewPage';
import GofeelerSplitView from './pages/GofeelerSplitView';
import CreateOrderPage from './pages/CreateOrderPage';
import AdminPage from './pages/AdminPage';
import ProjectHubPage from './pages/ProjectHubPage';
import MyProfilePage from './pages/MyProfilePage';
import ServiceLandingPage from './pages/ServiceLandingPage';
import InactiveUserScrim from './components/InactiveUserScrim';
import PmOrdersPage from './pages/PmOrdersPage';
import DeliveryTeamPage from './pages/DeliveryTeamPage';
import AccountsManagePage from './pages/AccountsManagePage';
import AmBillingPage from './pages/AmBillingPage';
import SearchResultsPage from './pages/SearchResultsPage';

// microverse.local carries everything platform-side (landing page,
// /dashboard, /accounts/view — path-based). Domain services get
// their own microsite subdomain instead — same app/build, just a
// different root route. `id` (not `key`/`name`) is what routing logic
// compares against — see data/services.js's SERVICE_THEME comment.
const currentService = SERVICE_THEME.find(
  (service) => service.subdomain && window.location.hostname.startsWith(`${service.subdomain}.`)
);
// gofeeler is the only domain service with a real built app so far
// (GofeelerSplitView) — every other microsite gets the public
// ServiceLandingPage info portal regardless of its current status.
const isGofeelerHost = currentService?.id === 'gofeeler';

// One SPA build serves every host, so the favicon has to be picked at
// runtime rather than baked into public/index.html: a service's own
// Tabler icon (the one the dashboard card used before the line-art
// illustration replaced it, see data/services.js) on its microsite,
// the Microverse logo everywhere else on the platform host.
if (currentService) {
  const Icon = currentService.icon;
  const svg = renderToStaticMarkup(<Icon color={currentService.dark.fg} size={32} />);
  setFavicon(`data:image/svg+xml,${encodeURIComponent(svg)}`);
} else {
  setFavicon(microverseLogo);
}

// No dedicated /login or /logout pages — keycloak-js already redirects
// to Keycloak's own hosted login/logout flow. Any failure case (no
// session, wrong role) just bounces to the public landing page for
// now; a real 403/error page is future work.
const RedirectToLanding = () => {
  useEffect(() => {
    window.location.href = landingUrl();
  }, []);
  return null;
};

const App = () => {
  const [keycloak, setKeycloak] = useState(null);

  useEffect(() => {
    initKeycloak()
      .then((keycloakInstance) => {
        setKeycloak(keycloakInstance);
      })
      .catch((error) => {
        console.error('Keycloak initialization failed:', error);
      });
  }, []);

  // PrivateRoute component to protect routes.
  // `roles` — the route renders if the user holds at least one (OR).
  //   Used for platform-function-only checks, e.g. /accounts/view just
  //   needs platform:customer OR platform:project-manager.
  // `requireAllRoles` — the route renders only if the user holds every
  //   one (AND). Used for the two-dimensional model (see
  //   ARCHITECTURE.md's Roles and permissions) where a service-scoped
  //   action needs both a platform function AND a service scope, e.g.
  //   GoFeeler's Create Order page needs platform:customer AND
  //   service:gofeeler — either alone isn't enough.
  // `customCheck` — an escape hatch for gates `roles`/`requireAllRoles`
  //   can't express, e.g. the Project Hub's "platform:project-manager
  //   + *any* service:* claim" (not a specific one — see
  //   ARCHITECTURE.md's Roles and permissions).
  const PrivateRoute = ({ element, keycloak, roles, requireAllRoles, customCheck }) => {
    if (!keycloak) {
      // Optionally, you can show a loader or a spinner while keycloak is loading
      return <div>Loading...</div>;
    }

    if (!keycloak.authenticated) {
      return <RedirectToLanding />;
    }

    if (roles && !roles.some((role) => keycloak.hasRealmRole(role))) {
      return <RedirectToLanding />;
    }

    if (requireAllRoles && !requireAllRoles.every((role) => keycloak.hasRealmRole(role))) {
      return <RedirectToLanding />;
    }

    if (customCheck && !customCheck(keycloak)) {
      return <RedirectToLanding />;
    }

    return element;
  };

  const hasAnyServiceScope = (kc) => (kc.tokenParsed?.realm_access?.roles || []).some((r) => r.startsWith('service:'));

  return (
    <ThemeProvider>
      <Router>
        <div>
          {/* Chrome follows the session, not the host — a logged-in
              user always gets the navbar; the public landing page only
              stays full-bleed for anonymous visitors */}
          {keycloak && keycloak.authenticated && <Navbar keycloak={keycloak} />}
          {keycloak && keycloak.authenticated && <InactiveUserScrim keycloak={keycloak} />}

          {/* Define Routes */}
          <Routes>
            <Route
              path="/"
              element={
                // Wait for initKeycloak() to resolve before picking a view —
                // otherwise this renders once with keycloak still null (so
                // it guesses "anonymous"/"no access") and again once the
                // real auth state lands, producing a visible flash: the
                // Login button on the platform host, or the coming-soon
                // portal briefly showing before a real GofeelerSplitView
                // user's task list replaces it. Nothing beats guessing
                // wrong first.
                !keycloak ? null : isGofeelerHost && keycloak.authenticated && keycloak.hasRealmRole('service:gofeeler') ? (
                  // Any staff-side platform role + service:gofeeler can view
                  // this page — PM sees every task, analyst/reviewer see only
                  // their own (GofeelerListPanel does that filtering internally)
                  <GofeelerSplitView />
                ) : currentService ? (
                  // The service landing page is public and open to anyone —
                  // it's the info portal a customer without service:gofeeler
                  // (or not logged in at all) reads to find out what the
                  // service does. Only a visitor who already holds the
                  // service role gets sent straight to the real app instead;
                  // see ServiceLandingPage's own comment for why this can't
                  // be a PrivateRoute redirect-on-fail like the rest of the
                  // app's gates.
                  <ServiceLandingPage serviceKey={currentService.key} />
                ) : (
                  <LandingPage />
                )
              }
            />
            {/* Protected Route */}
            <Route
              path="/dashboard"
              element={<PrivateRoute element={<Dashboard />} keycloak={keycloak} />}
            />

            {/* Accessible to any logged-in user regardless of role or
                `active` status — the one page an inactive user's scrim
                still lets through (see ARCHITECTURE.md's Roles and
                permissions). No roles/customCheck, same as Dashboard. */}
            <Route
              path="/profile"
              element={<PrivateRoute element={<MyProfilePage />} keycloak={keycloak} />}
            />

            {/* 6.5/6.6 — global search, reachable from any host/role.
                No roles/customCheck: 6.4's endpoint is itself the
                permission boundary (discovery-scoped per caller's
                service:* roles, platform:admin fails closed to no
                scope), so this route only needs "logged in". */}
            <Route
              path="/search"
              element={<PrivateRoute element={<SearchResultsPage />} keycloak={keycloak} />}
            />

            <Route
              path="/accounts/view"
              element={
                <PrivateRoute
                  element={<AccountsViewPage />}
                  keycloak={keycloak}
                  roles={['platform:customer', 'platform:project-manager']}
                />
              }
            />

            {/* 4.3 — Admin's Users/Services/Settings/Audit-log submenu
                items all share one route + component (tab from the URL
                segment); bare /admin lands on Users. */}
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route
              path="/admin/:tab"
              element={<PrivateRoute element={<AdminPage />} keycloak={keycloak} roles={['platform:admin']} />}
            />

            {/* Page-level gate is broad on purpose — platform:project-manager
                plus ANY service scope, not a specific one, since the page
                itself spans whatever services this PM manages. What's
                actually visible inside is filtered server-side (pm_accounts
                ownership + per-task service scope) — see ARCHITECTURE.md.
                Same gate reused across all of PM's 4.3 nav items below. */}
            <Route
              path="/projects/list"
              element={
                <PrivateRoute
                  element={<ProjectHubPage />}
                  keycloak={keycloak}
                  roles={['platform:project-manager']}
                  customCheck={hasAnyServiceScope}
                />
              }
            />

            <Route
              path="/pm/orders"
              element={
                <PrivateRoute
                  element={<PmOrdersPage />}
                  keycloak={keycloak}
                  roles={['platform:project-manager']}
                  customCheck={hasAnyServiceScope}
                />
              }
            />

            <Route path="/pm/delivery-team" element={<Navigate to="/pm/delivery-team/analysts" replace />} />
            <Route
              path="/pm/delivery-team/:tab"
              element={
                <PrivateRoute
                  element={<DeliveryTeamPage />}
                  keycloak={keycloak}
                  roles={['platform:project-manager']}
                  customCheck={hasAnyServiceScope}
                />
              }
            />

            {/* 4.3 — new platform:account-manager role; not yet
                provisioned in Keycloak, so these routes exist but
                nobody can reach them until the role is granted. */}
            <Route
              path="/projects/manage"
              element={
                <PrivateRoute
                  element={<AccountsManagePage />}
                  keycloak={keycloak}
                  roles={['platform:account-manager']}
                />
              }
            />
            <Route
              path="/am/billing"
              element={
                <PrivateRoute element={<AmBillingPage />} keycloak={keycloak} roles={['platform:account-manager']} />
              }
            />

            {/* On the gofeeler microsite, /create renders inside the same
                split-view shell as "/" (a panel next to the list, not a
                whole new page) — elsewhere it's a standalone full page,
                e.g. CustomerPage's "+ New order" link on the platform
                host */}
            <Route
              path="/create"
              element={
                <PrivateRoute
                  element={isGofeelerHost ? <GofeelerSplitView /> : <CreateOrderPage />}
                  keycloak={keycloak}
                  requireAllRoles={['platform:customer', 'service:gofeeler']}
                />
              }
            />

            {/* Always the split view (list + detail), regardless of host
                or how the viewer arrived — a notification, an email
                link, or a bookmark should land the same as clicking a
                row from the list itself, not a bare detail panel with no
                list beside it. Only gofeeler tasks exist right now, so
                this is gated the same as the gofeeler task list itself —
                will need to key off the fetched task's own `service`
                field once other domain services have tasks too. */}
            <Route
              path="/task/:id"
              element={<PrivateRoute element={<GofeelerSplitView />} keycloak={keycloak} roles={['service:gofeeler']} />}
            />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;
