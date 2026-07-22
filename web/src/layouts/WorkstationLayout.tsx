import { Outlet } from 'react-router-dom';
import { WorkstationSidebar } from '../components/WorkstationSidebar';

export function WorkstationLayout() {
  return (
    <div className="workstation-container min-h-screen ice-rink-bg">
      {/* Sidebar Navigation */}
      <WorkstationSidebar />

      {/* Main Content Area */}
      <main className="workstation-content min-h-screen ml-[72px] max-md:ml-0 max-md:mb-16 max-md:pb-[env(safe-area-inset-bottom)] relative z-0">
        <Outlet />
      </main>
    </div>
  );
}
