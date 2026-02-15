'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getRole, setRole as setRoleDb, seedDemoData, db } from '@/lib/db';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/rework', label: 'Rework Entry', icon: '📝' },
  { href: '/rcis', label: 'RCIS Insights', icon: '🧠' },
  { href: '/actions', label: 'Action Tracker', icon: '✅' },
  { href: '/heatmap', label: 'Risk Heat Map', icon: '🗺️' },
  { href: '/knowledge', label: 'Knowledge Bank', icon: '📚' },
  { divider: true },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const PAGE_TITLES = {
  '/': { title: 'Dashboard', sub: 'PM Line Rework Intelligence Overview' },
  '/rework': { title: 'Rework Entry', sub: 'Log rework data for PM Line stations' },
  '/rcis': { title: 'RCIS Insights', sub: 'Root Cause Intelligence & Pattern Analysis' },
  '/actions': { title: 'Action Tracker', sub: 'Corrective Actions & Status Monitoring' },
  '/heatmap': { title: 'Risk Heat Map', sub: 'Station × Severity Risk Matrix' },
  '/knowledge': { title: 'Knowledge Bank', sub: 'PM Line Digital Learning Library' },
  '/settings': { title: 'Settings', sub: 'System Configuration & Data Management' },
};

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const [role, setRoleState] = useState('Admin');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setRoleState(getRole());
    // Restore collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    (async () => {
      const count = await db.count('reworks');
      if (count === 0) {
        await seedDemoData();
      }
    })();
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const currentPage = PAGE_TITLES[pathname] || { title: 'Alstom RCIS', sub: '' };

  const handleRoleToggle = () => {
    const newRole = role === 'Admin' ? 'Viewer' : 'Admin';
    setRoleDb(newRole);
    setRoleState(newRole);
  };

  return (
    <html lang="en">
      <head>
        <title>Alstom RCIS – PM Line Rework Intelligence</title>
        <meta name="description" content="Power Module ESD Line Rework Intelligence System for manufacturing analytics and root cause tracking" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="sidebar-overlay"
              style={{ display: 'block' }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-brand">
              <h1>{collapsed ? <span>R</span> : <>ALSTOM <span>RCIS</span></>}</h1>
              {!collapsed && <p>PM Line Intelligence</p>}
            </div>

            <nav className="sidebar-nav">
              {NAV_ITEMS.map((item, i) =>
                item.divider ? (
                  <div key={i} className="sidebar-divider" />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={pathname === item.href ? 'active' : ''}
                    onClick={() => setSidebarOpen(false)}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                )
              )}
            </nav>

            <div className="sidebar-footer">
              {!collapsed && (
                <button
                  className={`role-badge ${role.toLowerCase()}`}
                  onClick={handleRoleToggle}
                  style={{ cursor: 'pointer', width: '100%' }}
                  title="Click to toggle role"
                >
                  {role === 'Admin' ? '🔑' : '👁️'} {role}
                </button>
              )}
              {collapsed && (
                <button
                  className={`role-badge ${role.toLowerCase()}`}
                  onClick={handleRoleToggle}
                  style={{ cursor: 'pointer', width: '100%', padding: '8px 0' }}
                  title={`Role: ${role} — Click to toggle`}
                >
                  {role === 'Admin' ? '🔑' : '👁️'}
                </button>
              )}
            </div>

            {/* Collapse toggle button */}
            <button
              className="sidebar-collapse-btn"
              onClick={toggleCollapse}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? '»' : '«'}
            </button>
          </aside>

          {/* Main content */}
          <main className="main-content">
            <div className="topbar">
              <div className="topbar-left">
                <button
                  className="mobile-menu-btn"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label="Toggle menu"
                >
                  ☰
                </button>
                <h2>{currentPage.title}</h2>
              </div>
              <div className="topbar-right">
                <span className="topbar-date">
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="page-content">
              {children}
            </div>

            {/* System Footer */}
            <footer className="system-footer">
              <div className="footer-content">
                <div className="footer-left">
                  <span>Powered By <strong>Jeevasurya</strong></span>
                  <span className="separator">•</span>
                  <span>EPU Manager: <a href="https://www.linkedin.com/in/ilakiya-k-20abb9207/" target="_blank" rel="noopener noreferrer" className="footer-link"><strong>Ilakiya K</strong></a></span>
                </div>
                <div className="footer-right">
                  <span>Alstom Transport India - Coimbatore</span>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
