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
        .workstation-container {
          min-height: 100vh;
          position: relative;
        }

        .workstation-content {
          min-height: 100vh;
          margin-left: 72px;
          position: relative;
          z-index: 0;
        }

        /* Mobile: Bottom nav layout */
        @media (max-width: 768px) {
          .workstation-content {
            margin-left: 0;
            margin-bottom: 64px;
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
    </div>
  );
}
