import { Sidebar } from '@/src/modules/boards/ui/Sidebar';
import { BoardThemeProvider } from '@/src/modules/boards/ui/BoardThemeContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoardThemeProvider>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </BoardThemeProvider>
  );
}
