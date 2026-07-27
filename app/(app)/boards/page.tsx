import { EmptyState } from '@/src/modules/ui/EmptyState';
import { InboxIcon } from '@/src/modules/ui/icons';

export default function BoardsIndexPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-page p-8">
      <EmptyState
        icon={<InboxIcon className="h-6 w-6" />}
        title="Elegí un tablero"
        description="O creá uno nuevo desde la barra lateral para empezar a organizar tus notas."
      />
    </div>
  );
}
