import { CalendarView } from '@/src/modules/calendar/ui/CalendarView';

export default async function CalendarPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <CalendarView boardId={boardId} />;
}
