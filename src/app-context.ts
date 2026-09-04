import { createContext, useContext } from 'react';
import type { Settings, MoodEntry } from './types';

export interface AppContextValue {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  entries: MoodEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MoodEntry[]>>;
}

export const AppContext = createContext<AppContextValue | null>(null);

const useAppContext = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext not available');
  return ctx;
};

export const useSettings = () => useAppContext().settings;
export const useUpdateSettings = () => useAppContext().updateSettings;
export const useEntries = () => { const { entries, setEntries } = useAppContext(); return [entries, setEntries] as const; };
