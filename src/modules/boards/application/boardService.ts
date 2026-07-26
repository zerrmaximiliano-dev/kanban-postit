import type { SupabaseClient } from '@supabase/supabase-js';
import * as boardsRepo from '../data/boardsRepo';
import * as columnsRepo from '../data/columnsRepo';
import type { Board, Column } from '../domain/types';

const DEFAULT_COLUMNS = ['Por hacer', 'En progreso', 'Hecho'];

export async function listMyBoards(client: SupabaseClient): Promise<Board[]> {
  return boardsRepo.listBoards(client);
}

export async function createBoardWithDefaults(
  client: SupabaseClient,
  name: string,
  ownerId: string
): Promise<{ board: Board; columns: Column[] }> {
  const board = await boardsRepo.createBoard(client, name, ownerId);
  const columns = await Promise.all(
    DEFAULT_COLUMNS.map((colName, i) => columnsRepo.createColumn(client, board.id, colName, i))
  );
  return { board, columns };
}

export async function getBoardColumns(client: SupabaseClient, boardId: string): Promise<Column[]> {
  return columnsRepo.listColumns(client, boardId);
}

export async function addColumn(client: SupabaseClient, boardId: string, name: string, order: number) {
  return columnsRepo.createColumn(client, boardId, name, order);
}

export { renameColumn, deleteColumn } from '../data/columnsRepo';
export { getBoard, renameBoard, deleteBoard } from '../data/boardsRepo';
