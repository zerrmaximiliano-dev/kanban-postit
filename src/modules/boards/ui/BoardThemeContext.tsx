'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface BoardThemeContextValue {
  boardColor: string | null;
  setBoardColor: (color: string | null) => void;
}

const BoardThemeContext = createContext<BoardThemeContextValue>({
  boardColor: null,
  setBoardColor: () => {},
});

export function BoardThemeProvider({ children }: { children: ReactNode }) {
  const [boardColor, setBoardColor] = useState<string | null>(null);
  return (
    <BoardThemeContext.Provider value={{ boardColor, setBoardColor }}>{children}</BoardThemeContext.Provider>
  );
}

export function useBoardTheme() {
  return useContext(BoardThemeContext);
}
