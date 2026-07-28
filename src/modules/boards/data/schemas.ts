import { z } from 'zod';

export const boardRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  owner_id: z.string().uuid(),
  org_id: z.string().uuid().nullable(),
  color: z.string().nullable(),
  share_token: z.string().uuid(),
});

export const boardMemberRowSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  invited_email: z.string().nullable(),
  role: z.enum(['owner', 'editor', 'viewer']),
  status: z.enum(['pending', 'accepted']),
});

export const columnRowSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int(),
});

export const checklistItemRowSchema = z.object({
  id: z.string().uuid(),
  note_id: z.string().uuid(),
  text: z.string(),
  done: z.boolean(),
  order: z.number().int(),
});

export const noteRowSchema = z.object({
  id: z.string().uuid(),
  column_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  color: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  tags: z.array(z.string()),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  order: z.number().int(),
});
