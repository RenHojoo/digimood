import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, Calendar, Grid3x3, List, Settings as SettingsIcon, Search } from 'lucide-react';
import { CalendarView } from './types';
import { navigateDate } from './utils';
import { Button, IconButton, Modal } from './ui';
import { useSettings } from './app-context';

const VIEW_CONFIG = {
  day: { icon: List, title: 'Day View' },
  month: { icon: Calendar, title: 'Month View' },
  year: { icon: Grid3x3, title: 'Year View' },
} as const;

const DateNavigation = ({ currentDate, onDateChange, activeView }: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  activeView: CalendarView;
}) => {
  const settings = useSettings();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempYear, setTempYear] = useState('');

  const handleDateClick = useCallback(() => {
    if (activeView === 'month') {
      setTempDate(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
      setIsDatePickerOpen(true);
    } else if (activeView === 'year') {
      setTempYear(String(currentDate.getFullYear()));
      setIsYearPickerOpen(true);
    }
  }, [activeView, currentDate]);

  const handleDateSubmit = useCallback(() => {
    if (activeView === 'month' && tempDate) {
      const [year, month] = tempDate.split('-').map(Number);
      const d = new Date(); d.setFullYear(year, month - 1, 1);
      if (!isNaN(d.getTime())) onDateChange(d);
      setIsDatePickerOpen(false);
    } else if (activeView === 'year' && tempYear) {
      const year = parseInt(tempYear);
      if (!isNaN(year)) { const d = new Date(currentDate); d.setFullYear(year); onDateChange(d); }
      setIsYearPickerOpen(false);
    }
  }, [activeView, currentDate, onDateChange, tempDate, tempYear]);

  const handleToday = useCallback(() => {
    const now = new Date();
    if (activeView === 'month') {
      setTempDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    } else if (activeView === 'year') {
      setTempYear(String(now.getFullYear()));
    }
  }, [activeView]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleDateSubmit();
    else if (e.key === 'Escape') { setIsDatePickerOpen(false); setIsYearPickerOpen(false); }
  }, [handleDateSubmit]);

  const titleContent = activeView === 'year'
    ? <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold">{currentDate.getFullYear()}</span>
    : activeView === 'day'
    ? <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold">All Entries</span>
    : (
      <div className="flex flex-col items-center">
        <span className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold leading-tight">
          {currentDate.toLocaleDateString(undefined, { month: 'long' })}
        </span>
        <span className="text-xs sm:text-sm md:text-base lg:text-lg opacity-70 leading-tight mt-1">
          {currentDate.getFullYear()}
        </span>
      </div>
    );

  const showNavigation = activeView !== 'day';

  return (
    <>
      <div className="nav-container">
        {showNavigation && (
          <IconButton
            icon={<ChevronUp size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />}
            onClick={() => onDateChange(navigateDate(currentDate, -1, activeView))}
            size="lg"
          />
        )}
        <div className="nav-center">
          <button onClick={handleDateClick} className="hover:opacity-80 transition-colors cursor-pointer text-center" disabled={activeView === 'day'}>
            {titleContent}
          </button>
        </div>
        {showNavigation && (
          <IconButton
            icon={<ChevronDown size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />}
            onClick={() => onDateChange(navigateDate(currentDate, 1, activeView))}
            size="lg"
          />
        )}
      </div>

      <Modal isOpen={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)} size="sm" showCloseButton={false}>
        <div className="flex gap-2 mb-4">
          <div className="month-input-wrapper flex-1">
            <input type="month" value={tempDate} onChange={e => setTempDate(e.target.value)} onKeyDown={handleKeyPress} className="input-base month-input" autoFocus aria-label="Choose month" />
            <Calendar className="month-input-icon" aria-hidden="true" />
          </div>
          <Button variant="secondary" size="sm" onClick={handleToday} className="flex-shrink-0">Today</Button>
        </div>
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={() => setIsDatePickerOpen(false)} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={handleDateSubmit} accentColor={settings.customColors.accent} className="flex-1">Go</Button>
        </div>
      </Modal>

      <Modal isOpen={isYearPickerOpen} onClose={() => setIsYearPickerOpen(false)} size="sm" showCloseButton={false}>
        <div className="flex gap-2 mb-4">
          <input type="number" value={tempYear} onChange={e => setTempYear(e.target.value)} onKeyDown={handleKeyPress} placeholder="Enter year" className="input-base flex-1" autoFocus />
          <Button variant="secondary" size="sm" onClick={handleToday} className="flex-shrink-0">Today</Button>
        </div>
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={() => setIsYearPickerOpen(false)} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={handleDateSubmit} accentColor={settings.customColors.accent} className="flex-1">Go</Button>
        </div>
      </Modal>
    </>
  );
};

export const Header = ({ currentDate, onDateChange, activeView, onViewChange, onSettingsClick, searchQuery, onSearchChange, isSettingsOpen }: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  activeView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSettingsOpen: boolean;
}) => {
  const settings = useSettings();

  return (
    <header className="card-base p-responsive-lg app-gap-mb">
      <div className="flex-between gap-responsive-md min-w-0">
        {activeView === 'day' ? (
          <div className="search-container">
            <Search size={18} className="icon-md flex-shrink-0" style={{ color: settings.customColors.accent }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="search-input"
              style={{ '--tw-placeholder-color': settings.customColors.text } as React.CSSProperties}
            />
          </div>
        ) : (
          <DateNavigation currentDate={currentDate} onDateChange={onDateChange} activeView={activeView} />
        )}
        <div className="nav-button-group">
          <div className="view-mode-toggle">
            {Object.entries(VIEW_CONFIG).map(([view, config]) => {
              const isActive = activeView === view;
              const Icon = config.icon;
              return (
                <button
                  key={view}
                  onClick={(e) => { e.currentTarget.blur(); onViewChange(view as CalendarView); }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.classList.add('view-mode-button-hover'); }}
                  onMouseLeave={(e) => { e.currentTarget.classList.remove('view-mode-button-hover'); }}
                  className={`view-mode-button ${isActive ? 'view-mode-button-active' : 'view-mode-button-inactive'}`}
                  title={config.title}
                >
                  <Icon size={16} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>
              );
            })}
          </div>
          <IconButton icon={<SettingsIcon size={18} className="icon-md" />} onClick={onSettingsClick} title="Settings" className={isSettingsOpen ? 'icon-button-active' : ''} />
        </div>
      </div>
    </header>
  );
};
