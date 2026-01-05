import { Outlet } from 'react-router-dom';
import { WorkstationSidebar } from '../components/WorkstationSidebar';

export function WorkstationLayout() {
  return (
    <div className="workstation-container min-h-screen ice-rink-bg">
      {/* Sidebar Navigation */}
      <WorkstationSidebar />

      {/* Main Content Area */}
      <main className="workstation-content">
        <Outlet />
      </main>

      <style>{`
        /* Desktop: Grid layout with sidebar */
        .workstation-container {
          display: grid;
          grid-template-columns: 72px 1fr;
          min-height: 100vh;
          overflow: hidden;
        }

        .workstation-content {
          margin-left: 0;
          min-height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Mobile: Bottom nav layout */
        @media (max-width: 768px) {
          .workstation-container {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
          }

          .workstation-content {
            margin-left: 0;
            margin-bottom: 64px; /* Space for bottom nav */
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
    </div>
  );
}
