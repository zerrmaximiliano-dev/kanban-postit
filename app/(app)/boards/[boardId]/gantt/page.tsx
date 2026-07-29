import { GanttView } from '@/src/modules/boards/ui/GanttView';

export default async function GanttPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <GanttView boardId={boardId} />;
}
