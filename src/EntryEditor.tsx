import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Undo, Redo, Bold, Italic, Underline, Save, Check, Palette } from 'lucide-react';
import { MoodEntry, MoodColor } from './types';
import { formatDate, formatDisplayDate } from './utils';
import { normalizeHTML, extractHTML, convertColorTags, applyMoodColors } from './rich-text';
import { useUndoRedo, useRichTextEditor } from './hooks';
import { MoodSelector, MoodPalette } from './MoodComponents';
import { useSettings } from './app-context';

const SAVE_DELAY_MS = 600;
const SAVE_IDLE_MS = 1000;
const HISTORY_DEBOUNCE_MS = 500;

const preventFocusLoss = (e: React.MouseEvent) => e.preventDefault();

export const EntryEditor: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  entry?: MoodEntry;
  onSave: (entry: MoodEntry) => void;
  registerCloseHandler?: (fn: (() => void) | null) => void;
}> = React.memo(({ isOpen, onClose, date, entry, onSave, registerCloseHandler }) => {
  const settings = useSettings();
  const [mood, setMood] = useState<MoodColor>(() => entry?.mood || 'grey');
  const [diary, setDiary] = useState(() => entry ? normalizeHTML(entry.diary || '') : '');
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const colorPickerContainerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fakeHighlightRef = useRef<HTMLElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const undoRedoInProgressRef = useRef(false);

  const { initHistory: reset, addToHistory, undo, redo, canUndo, canRedo } = useUndoRedo<{ diary: string; mood: MoodColor }>();
  const formattedDate = formatDisplayDate(date);
  const openedDateRef = useRef<string>('');
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const {
    savedSelectionRef,
    activeFormats,
    activeColor,
    activeMood,
    setActiveColor,
    saveSelection,
    updateActiveFormats,
    applyFormatting,
    applyColor: applyColorFromHook,
  } = useRichTextEditor(contentEditableRef, text => setDiary(text), extractHTML, isOpen);

  const insertFakeHighlight = useCallback(() => {
    if (!savedSelectionRef.current) return;
    const range = savedSelectionRef.current.cloneRange();
    if (range.collapsed) return;
    try {
      const mark = document.createElement('mark');
      mark.style.cssText = 'background:rgba(214,106,140,0.4);color:inherit;border-radius:2px;';
      mark.dataset.fakeHighlight = '1';
      range.surroundContents(mark);
      fakeHighlightRef.current = mark;
      const newRange = document.createRange();
      newRange.selectNodeContents(mark);
      savedSelectionRef.current = newRange;
    } catch {}
  }, [savedSelectionRef]);

  const removeFakeHighlight = useCallback(() => {
    const mark = fakeHighlightRef.current;
    if (!mark || !mark.parentNode) return;
    const parent = mark.parentNode;
    const firstChild = mark.firstChild;
    const lastChild = mark.lastChild;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    fakeHighlightRef.current = null;
    if (firstChild && lastChild) {
      try {
        const restored = document.createRange();
        restored.setStartBefore(firstChild);
        restored.setEndAfter(lastChild);
        savedSelectionRef.current = restored;
      } catch {}
    }
    const element = contentEditableRef.current;
    if (element) setDiary(extractHTML(element));
  }, [savedSelectionRef]);

  const keyboardRafRef = useRef<ReturnType<typeof requestAnimationFrame>>();

  useEffect(() => {
    if (!isOpen) return;
    let toolbarFixed = false;
    let pickerFixed = false;

    const applyFixed = (el: HTMLElement, bottom: number, zIndex: number) => {
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.right = '0';
      el.style.bottom = `${bottom}px`;
      el.style.zIndex = String(zIndex);
      el.style.transition = 'bottom .15s ease-out';
    };

    const removeFixed = (el: HTMLElement) => {
      el.style.position = '';
      el.style.left = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.zIndex = '';
      el.style.transition = '';
    };

    const update = () => {
      if (keyboardRafRef.current) cancelAnimationFrame(keyboardRafRef.current);
      keyboardRafRef.current = requestAnimationFrame(() => {
        if (!window.visualViewport) return;
        const vv = window.visualViewport;
        const h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const isKeyboard = h > 50;

        if (toolbarRef.current) {
          if (isKeyboard) {
            if (!toolbarFixed) {
              applyFixed(toolbarRef.current, h, 100);
              toolbarRef.current.style.backgroundColor = 'var(--c-base)';
              toolbarRef.current.style.borderTop = '1px solid rgba(128,128,128,0.2)';
              toolbarRef.current.style.padding = '8px 16px';
              toolbarFixed = true;
            } else {
              toolbarRef.current.style.bottom = `${h}px`;
            }
          } else if (toolbarFixed) {
            removeFixed(toolbarRef.current);
            toolbarRef.current.style.backgroundColor = '';
            toolbarRef.current.style.borderTop = '';
            toolbarRef.current.style.padding = '';
            toolbarFixed = false;
          }
        }

        if (colorPickerContainerRef.current && showColorPickerRef.current) {
          if (isKeyboard) {
            if (!pickerFixed) {
              applyFixed(colorPickerContainerRef.current, h + 56, 101);
              pickerFixed = true;
            } else {
              colorPickerContainerRef.current.style.bottom = `${h + 56}px`;
            }
          } else if (pickerFixed) {
            removeFixed(colorPickerContainerRef.current);
            pickerFixed = false;
          }
        } else if (pickerFixed && colorPickerContainerRef.current) {
          removeFixed(colorPickerContainerRef.current);
          pickerFixed = false;
        }
      });
    };
    const vv = window.visualViewport;
    if (vv) { vv.addEventListener('resize', update); vv.addEventListener('scroll', update); update(); }
    return () => {
      if (keyboardRafRef.current) cancelAnimationFrame(keyboardRafRef.current);
      if (vv) { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); }
      if (toolbarRef.current) removeFixed(toolbarRef.current);
      if (colorPickerContainerRef.current) removeFixed(colorPickerContainerRef.current);
    };
  }, [isOpen]);

  const showColorPickerRef = useRef(false);
  useEffect(() => { showColorPickerRef.current = showColorPicker; }, [showColorPicker]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (colorPickerRef.current?.contains(target) || colorPickerContainerRef.current?.contains(target)) return;
      removeFakeHighlight();
      setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker, removeFakeHighlight]);

  useLayoutEffect(() => {
    const dateKey = formatDate(date);
    const newMood = entry?.mood || 'grey';
    const newDiary = entry ? normalizeHTML(entry.diary || '') : '';
    setMood(newMood);
    setDiary(newDiary);
    // Only wipe history when a different date is opened, not on every save
    if (dateKey !== openedDateRef.current) {
      openedDateRef.current = dateKey;
      reset({ diary: newDiary, mood: newMood });
      setActiveColor(null);
    }
  }, [entry, date, reset, setActiveColor]);

  useEffect(() => {
    clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => addToHistory({ diary, mood }), HISTORY_DEBOUNCE_MS);
    return () => clearTimeout(historyDebounceRef.current);
  }, [diary, mood, addToHistory]);

  const handleUndo = () => {
    clearTimeout(historyDebounceRef.current);
    undoRedoInProgressRef.current = true;
    const prev = undo();
    if (prev) { setDiary(prev.diary || ''); setMood(prev.mood || 'grey'); }
    setTimeout(() => { undoRedoInProgressRef.current = false; }, 300);
  };

  const handleRedo = () => {
    clearTimeout(historyDebounceRef.current);
    undoRedoInProgressRef.current = true;
    const next = redo();
    if (next) { setDiary(next.diary || ''); setMood(next.mood || 'grey'); }
    setTimeout(() => { undoRedoInProgressRef.current = false; }, 300);
  };

  const handleContentKeyUp = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); applyFormatting('bold'); }
      else if (e.key === 'i') { e.preventDefault(); applyFormatting('italic'); }
      else if (e.key === 'u') { e.preventDefault(); applyFormatting('underline'); }
    }
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i' || e.key === 'u')) { e.preventDefault(); return; }
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  };

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      const pickerFocused = colorPickerRef.current?.contains(document.activeElement) ?? false;
      if (pickerFocused) return;
      updateActiveFormats(true);
      if (!showColorPicker) setActiveColor(null);
    }, 0);
  }, [showColorPicker, updateActiveFormats, setActiveColor]);

  const applyColor = (color: string | null, moodName?: string) => {
    applyColorFromHook(color, moodName, removeFakeHighlight);
  };

  const convertTagsToHTML = useCallback((text: string): string => {
    return normalizeHTML(convertColorTags(text));
  }, []);

  useEffect(() => {
    const element = contentEditableRef.current;
    if (!element) return;
    if (undoRedoInProgressRef.current) {
      element.innerHTML = convertTagsToHTML(diary);
      return;
    }
    if (document.activeElement === element) return;
    if (extractHTML(element) !== diary) {
      element.innerHTML = convertTagsToHTML(diary);
    }
  }, [diary, convertTagsToHTML]);

  // When mood colors change in settings, update the displayed colors in the editor
  // for any text that was colored using a mood palette entry.
  useEffect(() => {
    const element = contentEditableRef.current;
    if (!element || !isOpen) return;
    if (document.activeElement === element) return;
    const updated = applyMoodColors(element.innerHTML, settings);
    if (updated !== element.innerHTML) {
      element.innerHTML = updated;
      setDiary(extractHTML(element));
    }
  }, [settings.customColors.moods, isOpen]);

  const buildEntry = useCallback((): MoodEntry => ({ date: formatDate(date), mood, diary }), [date, mood, diary]);

  const handleSave = useCallback(() => {
    setSaveState('saving');
    onSave(buildEntry());
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveState('saved');
      saveTimeoutRef.current = setTimeout(() => setSaveState('idle'), SAVE_IDLE_MS);
    }, SAVE_DELAY_MS);
  }, [onSave, buildEntry]);

  const handleClose = useCallback(() => { onSave(buildEntry()); onClose(); }, [onSave, buildEntry, onClose]);

  useEffect(() => {
    if (registerCloseHandler) registerCloseHandler(handleClose);
    return () => { if (registerCloseHandler) registerCloseHandler(null); };
  }, [registerCloseHandler, handleClose]);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  useEffect(() => {
    const handler = () => onSave(buildEntry());
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [buildEntry, onSave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 z-50">
      <div className="diary-modal-container" style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
        <div className="header-container diary-header">
          <button onClick={handleClose} className="btn-icon" title="Close">
            <ChevronLeft size={24} />
          </button>
          <h2 className="header-title">{formattedDate}</h2>
          <button onClick={handleSave} className="btn-icon save-button-container" title="Save" disabled={saveState !== 'idle'}>
            <div className="save-icon-wrapper">
              {saveState === 'idle' && <Save size={24} />}
              {saveState === 'saving' && <div className="save-spinner" />}
              {saveState === 'saved' && <Check size={24} className="checkmark-icon" />}
            </div>
          </button>
        </div>

        <div className="diary-content-compact">
          <div className="diary-mood-section" style={{ backgroundColor: settings.customColors.base }}>
            <h3 className="diary-mood-title">How are you feeling?</h3>
            <div className="diary-mood-selector">
              <div className="flex flex-col items-center gap-0.5">
                <MoodSelector selectedMood={mood} onMoodChange={setMood} customLabels={settings.customLabels} date={date} settings={settings} />
                <div className="diary-mood-label mt-1">{settings.customLabels[mood]}</div>
              </div>
            </div>
          </div>

          <div className="diary-textarea-container-compact">
            <div className="flex-1 min-h-0 relative">
              <div
                ref={contentEditableRef}
                contentEditable
                onInput={() => { const el = contentEditableRef.current; if (el) setDiary(extractHTML(el)); }}
                onKeyUp={handleContentKeyUp}
                onKeyDown={handleContentKeyDown}
                onBlur={() => { handleBlur(); if (!undoRedoInProgressRef.current) handleSave(); }}
                onFocus={() => updateActiveFormats()}
                className={`diary-textarea${showColorPicker ? ' keep-selection' : ''}`}
                aria-label="Journal entry for today"
                suppressContentEditableWarning
                data-placeholder="Today, I..."
              />
            </div>

            {showColorPicker && (
              <div ref={colorPickerContainerRef} className="flex justify-center">
                <MoodPalette
                  moodColors={settings.customColors.moods}
                  moodLabels={settings.customLabels}
                  activeColor={activeColor}
                  activeMood={activeMood}
                  onColorSelect={(color, moodName) => applyColor(color, moodName)}
                  onColorClear={() => applyColor(null)}
                />
              </div>
            )}
            <div ref={toolbarRef} className="diary-actions-compact">
              <div className="flex gap-1">
                <button onMouseDown={preventFocusLoss} onClick={() => applyFormatting('bold')} className={`diary-action-button ${activeFormats.bold ? 'diary-action-active' : ''}`} title="Bold (Ctrl+B)" type="button"><Bold size={18} /></button>
                <button onMouseDown={preventFocusLoss} onClick={() => applyFormatting('italic')} className={`diary-action-button ${activeFormats.italic ? 'diary-action-active' : ''}`} title="Italic (Ctrl+I)" type="button"><Italic size={18} /></button>
                <button onMouseDown={preventFocusLoss} onClick={() => applyFormatting('underline')} className={`diary-action-button ${activeFormats.underline ? 'diary-action-active' : ''}`} title="Underline (Ctrl+U)" type="button"><Underline size={18} /></button>

                <div className="flex items-center" ref={colorPickerRef}>
                  <button
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      if (showColorPicker) { removeFakeHighlight(); setShowColorPicker(false); }
                      else { saveSelection(); insertFakeHighlight(); setShowColorPicker(true); }
                    }}
                    className={`diary-action-button ${activeColor ? 'diary-action-active' : ''}`}
                    title="Text Color"
                    type="button"
                  >
                    <Palette size={18} style={{ color: activeColor || undefined }} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1">
                <button onMouseDown={preventFocusLoss} onClick={handleUndo} disabled={!canUndo} className={`diary-action-button ${!canUndo ? 'diary-action-disabled' : ''}`} title="Undo"><Undo size={18} /></button>
                <button onMouseDown={preventFocusLoss} onClick={handleRedo} disabled={!canRedo} className={`diary-action-button ${!canRedo ? 'diary-action-disabled' : ''}`} title="Redo"><Redo size={18} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
