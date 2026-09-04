import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Header } from './Header';
import { EntryEditor } from './EntryEditor';
import { SettingsDialog as SettingsModal } from './SettingsDialog';
import { CalendarView, Settings, DEFAULT_SETTINGS, VIEW_ORDER } from './types';
import type { MoodEntry } from './types';
import { usePersistentStorage, useApplyTheme, useStatusMessage } from './hooks';
import { formatDate, parseDate } from './utils';
import { CalendarCarousel } from './CalendarCarousel';
import { MonthView, YearView, DayView } from './calendar';
import './styles.css';

import { AppContext } from './app-context';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [yearDate, setYearDate] = useState(new Date());
  const [activeView, setActiveView] = useState<CalendarView>('month');
  const [entries, setEntries] = usePersistentStorage<MoodEntry[]>('mood-entries', []);
  const [settings, setSettings] = usePersistentStorage<Settings>('mood-settings', DEFAULT_SETTINGS);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomTrigger, setZoomTrigger] = useState<{ direction: 'in' | 'out'; origin: { x: number; y: number } } | null>(null);
  const editorCloseRef = useRef<(() => void) | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);

  useApplyTheme(settings);
  const { statusMessage, showMessage } = useStatusMessage();

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, [setSettings]);

  useEffect(() => {
    if (!settings.customLabels) updateSettings({ customLabels: DEFAULT_SETTINGS.customLabels });
    const raw = window.localStorage.getItem('mood-settings');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const needsMoon = 'moonPhaseEnabled' in parsed && !('savedMoonPhaseBrightness' in parsed);
      const needsDark = 'isDarkMode' in parsed && !('isLightMode' in parsed);
      if (needsMoon || needsDark) {
        const m = { ...settings } as Record<string, unknown>;
        if (needsMoon) {
          m.savedMoonPhaseBrightness = parsed.moonPhaseBrightness || DEFAULT_SETTINGS.savedMoonPhaseBrightness;
          m.moonPhaseBrightness = parsed.moonPhaseEnabled ? parsed.moonPhaseBrightness : 0;
          delete m.moonPhaseEnabled;
        }
        if (needsDark) { m.isLightMode = !parsed.isDarkMode; delete m.isDarkMode; }
        setSettings(m as unknown as Settings);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener: { remove: () => void } | undefined;
    CapacitorApp.addListener('backButton', () => {
      if (selectedDate) { if (editorCloseRef.current) editorCloseRef.current(); else setSelectedDate(null); return; }
      if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      const idx = VIEW_ORDER.indexOf(activeView);
      if (idx < VIEW_ORDER.length - 1) { setActiveView(VIEW_ORDER[idx + 1]); return; }
      CapacitorApp.exitApp();
    }).then(handle => { listener = handle; });
    return () => { listener?.remove(); };
  }, [selectedDate, isSettingsOpen, activeView]);

  const handleSaveEntry = useCallback((entry: MoodEntry) => {
    setEntries(prev => {
      const existing = prev.find(e => e.date === entry.date);
      const shouldDelete = entry.mood === 'grey' && !entry.diary.trim();
      if (shouldDelete) {
        if (!existing) return prev;
        return prev.filter(e => e.date !== entry.date);
      }
      if (existing && existing.mood === entry.mood && existing.diary === entry.diary) return prev;
      const filtered = prev.filter(e => e.date !== entry.date);
      return [...filtered, entry];
    });
  }, [setEntries]);

  const currentEntry = useMemo(() => selectedDate
    ? entries.find(e => e.date === formatDate(selectedDate))
    : undefined, [selectedDate, entries]);

  const validEntries = useMemo(() => entries.filter(e => e.mood !== 'grey' || e.diary.trim()), [entries]);
  const backgroundClass = settings.backgroundImage ? '' : 'bg-dynamic-gradient';
  const activeViewIndex = VIEW_ORDER.indexOf(activeView);

  const handleZoomIn = useCallback(() => {
    const idx = VIEW_ORDER.indexOf(activeView);
    if (idx > 0) setActiveView(VIEW_ORDER[idx - 1]);
  }, [activeView]);

  const handleZoomOut = useCallback(() => {
    const idx = VIEW_ORDER.indexOf(activeView);
    if (idx < VIEW_ORDER.length - 1) {
      if (activeView === 'month') setYearDate(new Date(currentDate.getFullYear(), 0, 1));
      setActiveView(VIEW_ORDER[idx + 1]);
    }
  }, [activeView, currentDate]);

  const handleMonthZoomIn = useCallback((origin: { x: number; y: number }, monthDate: Date) => {
    setCurrentDate(monthDate);
    setYearDate(new Date(monthDate.getFullYear(), 0, 1));
    setZoomTrigger({ direction: 'in', origin });
  }, []);

  const handleZoomTriggerConsumed = useCallback(() => {
    setZoomTrigger(null);
  }, []);

  // Keep yearDate synced with currentDate's year so the off-screen YearView panel
  // always has mini-month tiles for the correct year (the zoom-origin lookup depends on it).
  // Only sync month→year, never year→month, so navigating years in year view
  // does not change the month view's position.
  useLayoutEffect(() => {
    if (activeView !== 'year' && currentDate.getFullYear() !== yearDate.getFullYear()) {
      setYearDate(new Date(currentDate.getFullYear(), 0, 1));
    }
  }, [currentDate, yearDate, activeView]);

  // Compute zoom origin in a layout effect (after DOM commit) so we read the
  // current DOM positions, not the previous render's stale layout.
  useLayoutEffect(() => {
    if (activeView !== 'year' && activeView !== 'month') { setZoomOrigin(null); return; }
    // currentDate holds the month that will be shown when zooming in from
    // year view, so its month index is the tile we want. The year grid
    // displays yearDate's year, so look the tile up there.
    const mi = currentDate.getMonth();
    const year = activeView === 'year' ? yearDate.getFullYear() : currentDate.getFullYear();

    const el = document.querySelector<HTMLElement>(`[data-month-key="${year}-${mi}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const carousel = document.querySelector<HTMLElement>('.app-carousel');
        if (carousel) {
          const carouselRect = carousel.getBoundingClientRect();
          const panel = el.closest('.carousel-panel') as HTMLElement | null;
          const panelRect = panel ? panel.getBoundingClientRect() : null;
          const panelOffset = panelRect ? panelRect.left - carouselRect.left : 0;
          const cx = rect.left - panelOffset + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          setZoomOrigin({
            x: (cx / window.innerWidth) * 100,
            y: (cy / window.innerHeight) * 100,
          });
          return;
        }
      }
    }

    // Fallback: estimate from the responsive grid layout
    const cols = window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 4 : 3;
    const rows = Math.ceil(12 / cols);
    const row = Math.floor(mi / cols);
    const col = mi % cols;
    setZoomOrigin({
      x: ((col + 0.5) / cols) * 100,
      y: ((row + 0.5) / rows) * 100,
    });
  }, [activeView, currentDate, yearDate]);

  const contextValue = useMemo(() => ({
    settings, updateSettings, entries, setEntries,
  }), [settings, updateSettings, entries, setEntries]);

  const carouselViews = useMemo(() => [
    { key: 'day', content: (
      <div className="carousel-panel-scrollable h-full">
          <DayView entries={validEntries} onEntryClick={entry => setSelectedDate(parseDate(entry.date))} searchQuery={searchQuery} />
      </div>
    )},
    { key: 'month', content: (
      <div className="h-full">
          <MonthView currentDate={currentDate} entries={entries} onEntryEdit={setSelectedDate} onDateChange={setCurrentDate} />
      </div>
    )},
    { key: 'year', content: (
        <YearView currentDate={yearDate} entries={entries} onDateChange={setYearDate} onViewChange={setActiveView} onMonthZoomIn={handleMonthZoomIn} />
    )},
  ], [validEntries, searchQuery, currentDate, entries, yearDate, handleMonthZoomIn]);

  return (
    <AppContext.Provider value={contextValue}>
      <div
        className={`h-full ${settings.isLightMode ? 'light-mode' : 'dark'} ${backgroundClass}`}
        style={{ overflow: 'hidden' }}
      >
        <div className="container mx-auto max-w-7xl app-layout">
          <Header
            currentDate={activeView === 'year' ? yearDate : currentDate}
            onDateChange={activeView === 'year' ? setYearDate : setCurrentDate}
            activeView={activeView}
            onViewChange={setActiveView}
            onSettingsClick={() => setIsSettingsOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isSettingsOpen={isSettingsOpen}
          />
          <main className="app-main">
            <CalendarCarousel
              views={carouselViews}
              activeIndex={activeViewIndex}
              onIndexChange={i => setActiveView(VIEW_ORDER[i])}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              zoomOrigin={zoomOrigin}
              zoomTrigger={zoomTrigger}
              onZoomTriggerConsumed={handleZoomTriggerConsumed}
              className="app-carousel"
            />
          </main>
          {selectedDate && (
            <EntryEditor
              key={formatDate(selectedDate)}
              isOpen={true}
              onClose={() => setSelectedDate(null)}
              date={selectedDate}
              entry={currentEntry}
              onSave={handleSaveEntry}
              registerCloseHandler={(fn) => { editorCloseRef.current = fn; }}
            />
          )}
          {isSettingsOpen && (
            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              onDeleteAllData={() => setEntries([])}
              showMessage={showMessage}
            />
          )}
          {statusMessage && (
            <div className={`status-message ${statusMessage.type === 'error' ? 'status-error' : 'status-success'}`}>
              {statusMessage.text}
            </div>
          )}
        </div>
      </div>
    </AppContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('initial-splash');
    if (splash) {
      splash.style.opacity = '0';
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      setTimeout(() => splash.remove(), 600);
    }
  });
});
