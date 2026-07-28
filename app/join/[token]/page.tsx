import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/src/modules/identity/data/supabaseServerClient';
import { joinViaShareLink } from '@/src/modules/boards/data/boardMembersRepo';

export default async function JoinBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  let boardId: string;
  try {
    boardId = await joinViaShareLink(supabase, token);
  } catch {
    redirect('/boards?error=invalid-invite');
  }

  redirect(`/boards/${boardId}`);
}
