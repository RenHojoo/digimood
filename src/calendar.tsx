import { useRef, useMemo, useState, useCallback, useEffect, memo, useLayoutEffect, KeyboardEvent } from 'react';
import { MoodEntry, MoodColor, CalendarView, WEEKDAYS } from './types';
import {
  navigateDate, getMonthsInYear, parseDate, areSameDates, isCurrentMonth, isToday,
  formatDate, getCalendarGrid, formatDisplayDate, isFutureDate,
  filterEntriesBySearch, sortEntriesByDate, indexEntriesByDate, safeDate,
} from './utils';
import { renderDiaryContent, renderSearchExcerpt } from './rich-text';
import { useHorizontalSwipe } from './hooks';
import { VerticalSwipeTrack } from './VerticalSwipeTrack';
import { Pencil } from 'lucide-react';
import { MoodShape } from './MoodComponents';
import { useSettings } from './app-context';

const handleKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};


const CalendarDay = memo<{
  date: Date;
  mood: MoodColor;
  hasEntry: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  isSelected?: boolean;
  onClick: () => void;
}>(({ date, mood, hasEntry, isToday, isCurrentMonth, isSelected = false, onClick }) => {
  const settings = useSettings();
  const isFuture = isFutureDate(date);
  const selectedBorder = isSelected ? `3px solid ${settings.customColors.text}` : undefined;

  const className = [
    'calendar-day-base',
    'calendar-day-medium',
    !isCurrentMonth && 'calendar-day-not-current-month',
    isFuture && 'calendar-day-future',
    hasEntry && !isToday && 'calendar-day-has-entry',
    isSelected && 'calendar-day-selected',
  ].filter(Boolean).join(' ');

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKey(onClick)}
      className={className}
      aria-label={`${date.toDateString()}, ${hasEntry ? 'Has entry' : 'No entry'}`}
      type="button"
    >
      <MoodShape date={date} mood={mood} settings={settings} selectedBorder={selectedBorder} />
      <span className="leading-none" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>{date.getDate()}</span>
    </button>
  );
});

const EmptyState = memo<{ searchQuery?: string }>(({ searchQuery = '' }) => {
  const hasSearch = searchQuery.trim().length > 0;
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{hasSearch ? '\uD83D\uDD0D' : ''}</div>
      <h3 className="empty-state-title">{hasSearch ? 'No results found...' : "No journal entries yet..."}</h3>
      <p className="empty-state-subtitle">{hasSearch ? 'There aren\u2019t any matching entries yet!' : 'All your entries will appear here!'}</p>
    </div>
  );
});

export const EntryPreview = memo<{
  date: Date;
  entry?: MoodEntry;
  onClick: () => void;
  truncateForDayView?: boolean;
  searchQuery?: string;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  expandRegistry?: {
    current: { expandedKey: string | null; collapse: (() => void) | null };
    onExpand: (key: string, collapse: () => void) => void;
    collapseOther?: (key: string) => boolean;
  };
}>(({ date, entry, onClick, truncateForDayView = false, searchQuery = '', onSwipePrev, onSwipeNext, expandRegistry }) => {
  const settings = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const scrollAnimRef = useRef(0);

  const scrollEntryToTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    let scroller: HTMLElement | null = el.parentElement;
    while (scroller) {
      const style = getComputedStyle(scroller);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && scroller.scrollHeight > scroller.clientHeight) {
        break;
      }
      scroller = scroller.parentElement;
    }

    if (!scroller) {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top, behavior: 'smooth' });
      return;
    }

    cancelAnimationFrame(scrollAnimRef.current);

    const startScrollTop = scroller.scrollTop;
    const duration = 1000;
    const startTime = performance.now();
    let interrupted = false;

    const cancel = () => {
      interrupted = true;
      cancelAnimationFrame(scrollAnimRef.current);
      scroller!.removeEventListener('wheel', cancel);
      scroller!.removeEventListener('touchstart', cancel);
      scroller!.removeEventListener('touchmove', cancel);
      scroller!.removeEventListener('mousedown', cancel);
    };
    scroller!.addEventListener('wheel', cancel, { passive: true });
    scroller!.addEventListener('touchstart', cancel, { passive: true });
    scroller!.addEventListener('touchmove', cancel, { passive: true });
    scroller!.addEventListener('mousedown', cancel);

    const tick = (now: number) => {
      if (interrupted) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      const scrollerTop = scroller!.getBoundingClientRect().top;
      const elTopInContent = scroller!.scrollTop + el.getBoundingClientRect().top - scrollerTop;

      scroller!.scrollTop = startScrollTop + (elTopInContent - startScrollTop) * eased;

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(tick);
      } else {
        cancel();
      }
    };

    scrollAnimRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(scrollAnimRef.current), []);

  useEffect(() => {
    if (isExpanded && truncateForDayView) {
      scrollEntryToTop();
    }
  }, [isExpanded, truncateForDayView, scrollEntryToTop]);

  const expandKey = entry?.date ?? '';
  const handleCardClick = useCallback(() => {
    if (!truncateForDayView) return;
    expandRegistry?.collapseOther?.(expandKey);
    scrollEntryToTop();
  }, [truncateForDayView, expandRegistry, expandKey, scrollEntryToTop]);
  const toggleExpanded = useCallback(() => {
    if (!isExpanded && contentRef.current) {
      const el = contentRef.current;
      const prevMaxHeight = el.style.maxHeight;
      const prevOverflow = el.style.overflow;
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      const h = el.scrollHeight;
      el.style.maxHeight = prevMaxHeight;
      el.style.overflow = prevOverflow;
      void el.offsetHeight;
      setFullHeight(h);
    }
    setIsExpanded(prev => {
      if (!prev && expandRegistry) {
        expandRegistry.onExpand(expandKey, () => setIsExpanded(false));
      }
      return !prev;
    });
  }, [isExpanded, expandRegistry, expandKey]);

  const formattedDate = formatDisplayDate(date);
  const isSearching = searchQuery.trim().length > 0;
  const canExpand = truncateForDayView && needsTruncation && !isSearching;

  const processedDiaryContent = useMemo(() => {
    const diary = entry?.diary || '';
    if (!diary) return null;

    if (isSearching) {
      return renderSearchExcerpt(diary, searchQuery, settings);
    }

    return renderDiaryContent(diary, settings, undefined, undefined, true);
  }, [entry?.diary, settings, searchQuery, isSearching]);

  useLayoutEffect(() => {
    if (truncateForDayView && !isSearching && contentRef.current && entry?.diary) {
      const style = getComputedStyle(contentRef.current);
      const lineHeight = parseFloat(style.lineHeight);
      const scrollH = contentRef.current.scrollHeight;
      const lineCount = settings.dayViewPreviewLines;
      setNeedsTruncation(scrollH > lineHeight * (lineCount + 0.5));
    }
  }, [truncateForDayView, isSearching, entry?.diary, settings.dayViewPreviewLines, settings.customColors.moods, settings.fontScale, processedDiaryContent]);

  const moodLabel = entry?.mood ? settings.customLabels[entry.mood] : 'No mood selected';

  const [swipeOffset, setSwipeOffset] = useState(0);
  const hasSwipe = !!(onSwipePrev || onSwipeNext);

  const swipe = useHorizontalSwipe({
    threshold: 60,
    onSwipe: (direction) => {
      setSwipeOffset(0);
      if (direction === 'backward' && onSwipePrev) onSwipePrev();
      else if (direction === 'forward' && onSwipeNext) onSwipeNext();
    },
  });

  const swipeStyle = hasSwipe && swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined;

  return (
    <div
      ref={containerRef}
      onClick={handleCardClick}
      className="card-base cursor-pointer hover:shadow-xl transition-shadow duration-200 entry-preview-centered"
      role="button"
      tabIndex={0}
      onKeyDown={handleKey(handleCardClick)}
      aria-label={`Entry for ${formattedDate}${entry?.diary ? ': ' + (entry.diary.length > 100 ? entry.diary.substring(0, 100) + '...' : entry.diary) : ''}`}
      onTouchStart={hasSwipe ? e => { e.stopPropagation(); swipe.begin(e.touches[0].clientX, e.touches[0].clientY); } : undefined}
      onTouchMove={hasSwipe ? e => { const offset = swipe.move(e.touches[0].clientX, e.touches[0].clientY); if (offset !== null) { e.stopPropagation(); setSwipeOffset(offset); } } : undefined}
      onTouchEnd={hasSwipe ? e => { if (swipe.isDragging.current) e.stopPropagation(); const result = swipe.end(); setSwipeOffset(result.offset); } : undefined}
      onMouseDown={hasSwipe ? e => { e.stopPropagation(); swipe.begin(e.clientX, e.clientY); } : undefined}
      onMouseMove={hasSwipe ? e => { if (e.buttons !== 1) return; const offset = swipe.move(e.clientX, e.clientY); if (offset !== null) setSwipeOffset(offset); } : undefined}
      onMouseUp={hasSwipe ? e => { if (e) e.stopPropagation(); const result = swipe.end(); setSwipeOffset(result.offset); } : undefined}
      onMouseLeave={hasSwipe ? () => { const result = swipe.end(); setSwipeOffset(result.offset); } : undefined}
      style={swipeStyle}
    >
      <div className="entry-header">
        <h3 className="entry-date">{formattedDate}</h3>
        <div className="entry-mood-indicator">
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              className="p-1 rounded-lg transition-colors hover:bg-black/10 flex-shrink-0"
              aria-label={entry ? 'Edit entry' : 'Add entry'}
              type="button"
            >
              <Pencil className="w-4 h-4" style={{ color: 'var(--c-text)' }} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              className="flex-shrink-0"
              aria-label={entry ? 'Edit entry' : 'Add entry'}
              type="button"
            >
              <MoodShape
                date={date}
                mood={entry?.mood || 'grey'}
                settings={settings}
                className="w-5 h-5 sm:w-6 sm:h-6"
                aria-label={entry ? `Mood: ${moodLabel}` : 'No mood selected'}
              />
            </button>
          </div>
        </div>
      </div>
      {entry?.diary && (
        <p
          ref={contentRef}
          className={`entry-content ${truncateForDayView && !isSearching && needsTruncation ? `entry-content-truncated needs-truncation ${isExpanded ? 'entry-expanded' : ''}` : ''}`}
          style={{
            '--preview-lines': settings.dayViewPreviewLines,
            ...(fullHeight !== null ? { '--full-height': `${fullHeight}px` } as React.CSSProperties : {}),
          } as React.CSSProperties}
          onClick={canExpand ? e => { e.stopPropagation(); toggleExpanded(); } : undefined}
        >
          {processedDiaryContent}
        </p>
      )}
    </div>
  );
});

const MiniMonth = memo<{
  monthDate: Date;
  entriesMap: Map<string, MoodEntry>;
  onMonthClick: (date: Date, element: HTMLElement) => void;
}>(({ monthDate, entriesMap, onMonthClick }) => {
  const settings = useSettings();
  const days = useMemo(() => {
    const grid = getCalendarGrid(monthDate);
    const spacer = <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3" />;
    return grid.map((date, i) => {
      if (!isCurrentMonth(date, monthDate)) return <div key={i}>{spacer}</div>;
      const entry = entriesMap.get(formatDate(date));
      return (
        <MoodShape key={i} date={date} mood={entry?.mood || 'grey'} settings={settings} size="sm"
          className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
      );
    });
  }, [monthDate, entriesMap, settings]);

  const monthName = monthDate.toLocaleDateString(undefined, { month: 'long' });

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    onMonthClick(monthDate, e.currentTarget);
  }, [monthDate, onMonthClick]);

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKey(() => onMonthClick(monthDate, document.activeElement as HTMLElement))}
      className="mini-month-container p-2 sm:p-2.5 lg:p-3"
      style={{ backgroundColor: 'var(--c-base-adj)' }}
      aria-label={`View ${monthName} ${monthDate.getFullYear()}`}
      data-month-key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
      type="button"
    >
      <h3 className="mini-month-title">{monthName}</h3>
      <div className="mini-month-grid">{days}</div>
    </button>
  );
});

export const DayView = memo<{
  entries: MoodEntry[];
  onEntryClick: (entry: MoodEntry) => void;
  searchQuery?: string;
}>(({ entries, onEntryClick, searchQuery = '' }) => {
  const settings = useSettings();
  const sortedEntries = useMemo(() => {
    const filtered = filterEntriesBySearch(entries, searchQuery, settings);
    return sortEntriesByDate(filtered, false);
  }, [entries, searchQuery, settings]);

  const expandRegistry = useMemo(() => ({
    current: { expandedKey: null as string | null, collapse: null as (() => void) | null },
    onExpand: (key: string, collapse: () => void) => {
      const reg = expandRegistry.current;
      if (reg.expandedKey !== null && reg.expandedKey !== key && reg.collapse) {
        reg.collapse();
      }
      reg.expandedKey = key;
      reg.collapse = collapse;
    },
    collapseOther: (key: string) => {
      const reg = expandRegistry.current;
      if (reg.expandedKey !== null && reg.expandedKey !== key && reg.collapse) {
        reg.collapse();
        reg.expandedKey = null;
        reg.collapse = null;
        return true;
      }
      return false;
    },
  }), []);

  if (sortedEntries.length === 0) {
    return <div role="list" aria-label="Mood entries"><EmptyState searchQuery={searchQuery} /></div>;
  }

  return (
    <div className="app-gap-list" role="list" aria-label="Mood entries">
      {sortedEntries.map(entry => (
        <EntryPreview
          key={entry.date}
          date={parseDate(entry.date)}
          entry={entry}
          onClick={() => onEntryClick(entry)}
          truncateForDayView={true}
          searchQuery={searchQuery}
          expandRegistry={expandRegistry}
        />
      ))}
    </div>
  );
});

const MonthGrid = memo<{
  monthDate: Date;
  entriesMap: Map<string, MoodEntry>;
  selectedDate: Date | null;
  onDayClick: (date: Date) => void;
}>(({ monthDate, entriesMap, selectedDate, onDayClick }) => {
  const getEntryForDate = useCallback((date: Date) => entriesMap.get(formatDate(date)), [entriesMap]);

  const calendarDays = useMemo(() => {
    const grid = getCalendarGrid(monthDate);
    return grid.map((date, i) => {
      const entry = getEntryForDate(date);
      return (
        <CalendarDay key={i} date={date} mood={entry?.mood || 'grey'} hasEntry={!!entry}
          isToday={isToday(date)} isCurrentMonth={isCurrentMonth(date, monthDate)} isSelected={selectedDate ? areSameDates(selectedDate, date) : false}
          onClick={() => onDayClick(date)} />
      );
    });
  }, [monthDate, getEntryForDate, selectedDate, onDayClick]);

  return (
    <div className="card-base p-responsive-lg month-view-calendar">
      <div className="grid-calendar gap-1 sm:gap-2 lg:gap-3 mb-2 sm:mb-3 lg:mb-4">
        {WEEKDAYS.map(day => <div key={day} className="calendar-weekday">{day}</div>)}
      </div>
      <div className="grid-calendar gap-1.5 sm:gap-2">{calendarDays}</div>
    </div>
  );
});

export const MonthView = memo<{
  currentDate: Date;
  entries: MoodEntry[];
  onEntryEdit: (date: Date) => void;
  onDateChange: (date: Date) => void;
}>(({ currentDate, entries, onEntryEdit, onDateChange }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previewDirection, setPreviewDirection] = useState<'left' | 'right' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const entriesMap = useMemo(() => indexEntriesByDate(entries), [entries]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(prev => prev && areSameDates(prev, date) ? null : date);
  }, []);

  const selectedEntry = selectedDate ? entriesMap.get(formatDate(selectedDate)) : undefined;

  const navigatePreview = useCallback((direction: -1 | 1) => {
    const d = new Date(selectedDate!);
    d.setDate(d.getDate() + direction);
    const targetMonth = safeDate(d.getFullYear(), d.getMonth(), 1);
    if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
      onDateChange(targetMonth);
    }
    setPreviewDirection(direction > 0 ? 'right' : 'left');
    setAnimationKey(k => k + 1);
    setSelectedDate(d);
  }, [selectedDate, currentDate, onDateChange]);

  const monthItems = useMemo(() => {
    return [-1, 0, 1].map(delta => {
      const monthDate = navigateDate(currentDate, delta, 'month');
      return {
        key: delta === -1 ? 'prev' : delta === 0 ? 'current' : 'next',
        render: () => (
          <MonthGrid
            monthDate={monthDate}
            entriesMap={entriesMap}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
          />
        ),
      };
    });
  }, [currentDate, entriesMap, selectedDate, handleDayClick]);

  const handleMonthIndexChange = useCallback((index: number) => {
    if (index === 2) onDateChange(navigateDate(currentDate, 1, 'month'));
    else if (index === 0) onDateChange(navigateDate(currentDate, -1, 'month'));
  }, [currentDate, onDateChange]);

  return (
    <div className="month-view-layout">
      <VerticalSwipeTrack
        items={monthItems}
        activeIndex={1}
        onIndexChange={handleMonthIndexChange}
        className="month-view-track"
        contentClassName="month-view-content"
        fitToContent
      />

      {selectedDate && (
        <div className="month-view-preview">
          <div
            key={animationKey}
            className={previewDirection === 'right' ? 'preview-slide-in-right' : previewDirection === 'left' ? 'preview-slide-in-left' : 'preview-slide-idle'}
            onAnimationEnd={() => setPreviewDirection(null)}
          >
            <EntryPreview
              date={selectedDate}
              entry={selectedEntry}
              onClick={() => onEntryEdit(selectedDate)}
              onSwipePrev={() => navigatePreview(-1)}
              onSwipeNext={() => navigatePreview(1)}
            />
          </div>
        </div>
      )}
    </div>
  );
});

const YearGrid = memo<{
  year: number;
  entriesMap: Map<string, MoodEntry>;
  onMonthClick: (monthDate: Date, element: HTMLElement) => void;
}>(({ year, entriesMap, onMonthClick }) => (
  <div className="grid-responsive-3-4-6 app-gap-grid">
    {getMonthsInYear(year).map(monthDate => (
      <MiniMonth
        key={monthDate.getMonth()}
        monthDate={monthDate}
        entriesMap={entriesMap}
        onMonthClick={onMonthClick}
      />
    ))}
  </div>
));

export const YearView = memo<{
  currentDate: Date;
  entries: MoodEntry[];
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onMonthZoomIn?: (origin: { x: number; y: number }, monthDate: Date) => void;
}>(({ currentDate, entries, onDateChange, onViewChange, onMonthZoomIn }) => {
  const displayYear = currentDate.getFullYear();
  const entriesMap = useMemo(() => indexEntriesByDate(entries), [entries]);

  const handleMonthClick = useCallback((monthDate: Date, element: HTMLElement) => {
    if (onMonthZoomIn) {
      const rect = element.getBoundingClientRect();
      const origin = {
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      };
      onMonthZoomIn(origin, monthDate);
    } else {
      onDateChange(monthDate);
      onViewChange('month');
    }
  }, [onDateChange, onViewChange, onMonthZoomIn]);

  const yearItems = useMemo(() => {
    return [-1, 0, 1].map(delta => ({
      key: delta === -1 ? 'prev' : delta === 0 ? 'current' : 'next',
      render: () => (
        <YearGrid
          year={displayYear + delta}
          entriesMap={entriesMap}
          onMonthClick={handleMonthClick}
        />
      ),
    }));
  }, [displayYear, entriesMap, handleMonthClick]);

  const handleYearIndexChange = useCallback((index: number) => {
    if (index === 2) onDateChange(navigateDate(currentDate, 1, 'year'));
    else if (index === 0) onDateChange(navigateDate(currentDate, -1, 'year'));
  }, [currentDate, onDateChange]);

  return (
    <VerticalSwipeTrack
      items={yearItems}
      activeIndex={1}
      onIndexChange={handleYearIndexChange}
      className="year-view-track"
      contentClassName="year-view-content"
    />
  );
});
