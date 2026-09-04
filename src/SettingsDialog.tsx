import React, { useState, useCallback, useRef } from 'react';
import {
  Image,
  RotateCcw,
  Sun,
  Moon,
  X,
  Type,
  ChevronDown,
  Plus,
  Minus,
  Upload,
} from 'lucide-react';
import { MoodColor, DEFAULT_SETTINGS, isMoodColorKey, FONT_OPTIONS, fontCss, MoodShape as MoodShapeType } from './types';
import { Modal, Button, ConfirmModal } from './ui';
import { MoodShape } from './MoodComponents';
import { ColorPicker } from './ColorPicker';
import { compressImage, parseHexToRgb } from './utils';
import { useSettings, useUpdateSettings } from './app-context';
import { DataManagementSection } from './DataSection';

const THEME_COLOR_TITLES: Record<string, string> = {
  background: 'Background',
  base: 'Base',
  accent: 'Accent',
  text: 'Text',
};

const MOOD_SHAPES: MoodShapeType[] = ['orb', 'petal', 'strawberry'];

export const SettingsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onDeleteAllData: () => void;
  showMessage: (message: string, type?: 'success' | 'error') => void;
}> = ({ isOpen, onClose, onDeleteAllData, showMessage }) => {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [tempColor, setTempColor] = useState('#000000');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRemoveBgColorConfirm, setShowRemoveBgColorConfirm] = useState(false);
  const [showRemoveBgImageConfirm, setShowRemoveBgImageConfirm] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState('');
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const savedSettingsRef = useRef<typeof settings | null>(null);

  const handleColorChange = useCallback(
    (color: string) => {
      setTempColor(color);
      if (!activeColorPicker || isMoodColorKey(activeColorPicker)) return;
      if (activeColorPicker === 'background') {
        updateSettings({ backgroundColor: color });
      } else {
        updateSettings({
          customColors: {
            ...settings.customColors,
            [activeColorPicker as 'base' | 'accent' | 'text']: color,
          },
        });
      }
    },
    [activeColorPicker, settings.customColors, updateSettings]
  );

  const removeBackground = useCallback(() => {
    updateSettings({ backgroundImage: undefined });
  }, [updateSettings]);

  const resetTheme = useCallback(() => {
    updateSettings({
      isLightMode: false,
      customColors: DEFAULT_SETTINGS.customColors,
      customLabels: DEFAULT_SETTINGS.customLabels,
      backgroundImage: undefined,
      backgroundColor: undefined,
      moonPhaseBrightness: DEFAULT_SETTINGS.moonPhaseBrightness,
      savedMoonPhaseBrightness: DEFAULT_SETTINGS.savedMoonPhaseBrightness,
      moodShape: DEFAULT_SETTINGS.moodShape,
      fontFamily: DEFAULT_SETTINGS.fontFamily,
      fontScale: DEFAULT_SETTINGS.fontScale,
      baseOpacity: DEFAULT_SETTINGS.baseOpacity,
      dayViewPreviewLines: DEFAULT_SETTINGS.dayViewPreviewLines,
    });
    setActiveColorPicker(null);
  }, [updateSettings]);

  const openColorPicker = useCallback(
    (colorKey: string) => {
      let currentColor: string;
      if (colorKey === 'background') {
        currentColor = settings.backgroundColor || settings.customColors.base;
      } else if (colorKey === 'base' || colorKey === 'accent' || colorKey === 'text') {
        currentColor = settings.customColors[colorKey as 'base' | 'accent' | 'text'];
      } else {
        currentColor = settings.customColors.moods[colorKey as MoodColor];
      }
      savedSettingsRef.current = settings;
      setTempColor(currentColor);
      setActiveColorPicker(colorKey);
      setIsEditingLabel(false);
      if (isMoodColorKey(colorKey)) setTempLabel(settings.customLabels[colorKey]);
    },
    [settings]
  );

  const applyColor = useCallback(() => {
    if (!activeColorPicker) return;
    if (isMoodColorKey(activeColorPicker)) {
      updateSettings({
        customColors: {
          ...settings.customColors,
          moods: { ...settings.customColors.moods, [activeColorPicker]: tempColor },
        },
      });
    }
    savedSettingsRef.current = null;
    setFontDropdownOpen(false);
    setActiveColorPicker(null);
  }, [activeColorPicker, tempColor, settings.customColors, updateSettings]);

  const cancelColorPicker = useCallback(() => {
    if (savedSettingsRef.current) {
      const saved = savedSettingsRef.current;
      updateSettings({
        ...saved,
        backgroundColor: saved.backgroundColor,
        backgroundImage: saved.backgroundImage,
      });
      savedSettingsRef.current = null;
    }
    setFontDropdownOpen(false);
    setActiveColorPicker(null);
  }, [updateSettings]);

  const handleBackgroundImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showMessage('Image too large. Please use an image smaller than 10MB.', 'error');
        event.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        showMessage('Please select a valid image file.', 'error');
        event.target.value = '';
        return;
      }
      try {
        const dataUrl = await compressImage(file, 1920, 1080, 0.85);
        if (dataUrl.length > 5 * 1024 * 1024) {
          showMessage('Compressed image still too large. Please use a smaller image.', 'error');
          event.target.value = '';
          return;
        }
        updateSettings({ backgroundImage: dataUrl });
      } catch (error) {
        showMessage(`${error instanceof Error ? error.message : 'Error processing image'}. Please try again.`, 'error');
      }
      event.target.value = '';
    },
    [updateSettings, showMessage]
  );

  const colorPickerTitle = activeColorPicker
    ? THEME_COLOR_TITLES[activeColorPicker] || settings.customLabels[activeColorPicker as MoodColor]
    : '';

  const updateLabel = useCallback(
    (moodKey: MoodColor, label: string) => {
      updateSettings({ customLabels: { ...settings.customLabels, [moodKey]: label } });
    },
    [settings.customLabels, updateSettings]
  );

  const handleLabelSubmit = useCallback(() => {
    if (activeColorPicker && tempLabel.trim())
      updateLabel(activeColorPicker as MoodColor, tempLabel.trim());
    setIsEditingLabel(false);
  }, [activeColorPicker, tempLabel, updateLabel]);

  const handleLabelKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleLabelSubmit();
      else if (e.key === 'Escape') {
        setIsEditingLabel(false);
        if (activeColorPicker)
          setTempLabel(settings.customLabels[activeColorPicker as MoodColor]);
      }
    },
    [handleLabelSubmit, activeColorPicker, settings.customLabels]
  );

  const activeIsMood = activeColorPicker ? isMoodColorKey(activeColorPicker) : false;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div>
          <section aria-labelledby="appearance-heading">
            <div className="flex items-center justify-between">
              <h3 className="section-title" id="appearance-heading">Theme Colors</h3>
              <button onClick={() => setShowResetConfirm(true)} className="settings-reset-button">
                <RotateCcw size={12} />
                Reset
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => updateSettings({ isLightMode: !settings.isLightMode })}
                className="theme-toggle flex-shrink-0"
              >
                <div
                  className={`theme-toggle-slider ${settings.isLightMode ? 'theme-toggle-active' : ''}`}
                  style={{ backgroundColor: settings.customColors.accent }}
                >
                  {settings.isLightMode ? <Moon size={12} /> : <Sun size={12} />}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => openColorPicker('base')} className="color-button" style={{ backgroundColor: settings.customColors.base }} title="Base Color" />
                <button onClick={() => openColorPicker('accent')} className="color-button" style={{ backgroundColor: settings.customColors.accent }} title="Accent Color" />
                <button
                  onClick={() => openColorPicker('background')}
                  className="color-button cursor-pointer flex-center"
                  style={{ backgroundColor: settings.backgroundColor || settings.customColors.base }}
                  title="Background Color"
                >
                  <Image size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
                <button
                  onClick={() => openColorPicker('text')}
                  className="color-button flex-center text-lg font-bold"
                  style={{ fontSize: `calc(24px * var(--app-font-scale, 1))`, fontFamily: 'Georgia', color: settings.customColors.text }}
                  title="Text Color"
                >
                  A
                </button>
              </div>
            </div>

            <div className="color-grid-moods mt-4">
              {Object.entries(settings.customColors.moods).map(([mood]) => (
                <button
                  key={mood}
                  onClick={() => openColorPicker(mood)}
                  className="color-button-mood"
                  title={settings.customLabels[mood as MoodColor]}
                  style={{ padding: 0, overflow: 'visible', border: 'none' }}
                >
                  <MoodShape date={new Date()} mood={mood as MoodColor} settings={settings} outline previewMoonPhase={0.85} />
                </button>
              ))}
            </div>

            <div className="settings-section">
              <label className="settings-slider-label">Mood Shape</label>
              <div className="settings-shape-options mt-2">
                {MOOD_SHAPES.map((shape) => {
                  const isSelected = settings.moodShape === shape;
                  const previewMood = Object.keys(settings.customColors.moods)[0] as MoodColor;
                  const previewSettings = isSelected
                    ? { ...settings, moodShape: shape, customColors: { ...settings.customColors, moods: { ...settings.customColors.moods, [previewMood]: settings.customColors.accent } } }
                    : { ...settings, moodShape: shape };
                  return (
                    <button key={shape} type="button" onClick={() => updateSettings({ moodShape: shape })} className="settings-shape-button" title={shape.charAt(0).toUpperCase() + shape.slice(1)}>
                      <div className="w-7 h-7">
                        <MoodShape date={new Date()} mood={previewMood} settings={previewSettings} size="sm" previewMoonPhase={0.85} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="settings-section">
              <label className="settings-slider-label">Moon Phase Opacity</label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => {
                    const isOn = settings.moonPhaseBrightness !== 0;
                    updateSettings(
                      isOn
                        ? { moonPhaseBrightness: 0, savedMoonPhaseBrightness: settings.moonPhaseBrightness }
                        : { moonPhaseBrightness: settings.savedMoonPhaseBrightness || DEFAULT_SETTINGS.savedMoonPhaseBrightness }
                    );
                  }}
                  className="theme-toggle flex-shrink-0"
                  type="button"
                >
                  <div
                    className={`theme-toggle-slider ${settings.moonPhaseBrightness !== 0 ? 'theme-toggle-active' : ''}`}
                    style={{ backgroundColor: settings.moonPhaseBrightness !== 0 ? settings.customColors.accent : settings.customColors.base }}
                  >
                    <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
                      <path d="M 50 5 A 45 45 0 1 0 50 95 A 30 30 0 1 1 50 5 Z" />
                    </svg>
                  </div>
                </button>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={settings.moonPhaseBrightness}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateSettings({ moonPhaseBrightness: val, ...(val !== 0 ? { savedMoonPhaseBrightness: val } : {}) });
                  }}
                  className="settings-moon-slider"
                  style={{ opacity: settings.moonPhaseBrightness !== 0 ? 1 : 0.4 }}
                />
              </div>
            </div>

            <div className="settings-section">
              <label className="settings-slider-label">Day View Preview Lines</label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm" style={{ minWidth: '1rem', textAlign: 'left' }}>
                  {settings.dayViewPreviewLines}
                </span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={settings.dayViewPreviewLines}
                  onChange={(e) => updateSettings({ dayViewPreviewLines: parseInt(e.target.value) })}
                  className="settings-moon-slider"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </section>

          <DataManagementSection
            onDeleteAllData={onDeleteAllData}
            showMessage={showMessage}
            accentColor={settings.customColors.accent}
          />
        </div>
      </Modal>

      <Modal isOpen={!!activeColorPicker} onClose={cancelColorPicker} size="sm" showCloseButton={false}>
        <div className="color-picker-modal-body">
          <div className="color-picker-container">
            <div className="color-picker-title">{activeIsMood ? 'Mood Label' : 'Theme Color'}</div>
            {isEditingLabel ? (
              <div className="color-picker-label-wrapper">
                <input
                  type="text"
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  onBlur={handleLabelSubmit}
                  onKeyDown={handleLabelKeyDown}
                  className="color-picker-label-input"
                  autoFocus
                  maxLength={20}
                />
              </div>
            ) : (
              <div
                className="color-picker-subtitle"
                onClick={() => { if (activeIsMood) setIsEditingLabel(true); }}
                style={{ cursor: activeIsMood ? 'pointer' : 'default' }}
              >
                {colorPickerTitle}
              </div>
            )}
          </div>

          <div className="color-picker-display">
            <ColorPicker color={tempColor} onChange={handleColorChange} />
          </div>

          <div className="color-picker-input-row">
            <div className="color-picker-preview" style={{ backgroundColor: tempColor }} />
            <input type="text" value={tempColor} onChange={(e) => handleColorChange(e.target.value)} className="color-picker-text-input" />
            {(['R', 'G', 'B'] as const).map((_, i) => (
              <input
                key={i}
                type="number"
                min={0}
                max={255}
                value={parseHexToRgb(tempColor)[i]}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                  const [r, g, b] = parseHexToRgb(tempColor);
                  const rgb = [r, g, b];
                  rgb[i] = val;
                  handleColorChange('#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''));
                }}
                className="color-picker-rgb-input"
              />
            ))}
            {activeColorPicker === 'background' && settings.backgroundColor && (
              <button onClick={() => setShowRemoveBgColorConfirm(true)} className="btn-icon flex-shrink-0" title="Remove Color" style={{ opacity: 0.7 }}>
                <X size={16} />
              </button>
            )}
          </div>

          {activeColorPicker === 'text' && (
            <div className="font-row">
              <div className="font-selector-wrapper">
                <button type="button" onClick={() => setFontDropdownOpen(o => !o)} className="font-selector-button" style={{ fontFamily: fontCss(settings.fontFamily) }}>
                  <Type size={14} />
                  {FONT_OPTIONS.find(o => o.value === settings.fontFamily)?.label ?? 'System'}
                  <ChevronDown size={12} />
                </button>
                {fontDropdownOpen && (
                  <div className="font-selector-dropdown">
                    {FONT_OPTIONS.map(opt => (
                      <div
                        key={opt.value}
                        onClick={() => { updateSettings({ fontFamily: opt.value }); setFontDropdownOpen(false); }}
                        className={`font-selector-option ${settings.fontFamily === opt.value ? 'font-selector-option-selected' : ''}`}
                        style={{ fontFamily: opt.css }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="font-size-stepper">
                <button
                  type="button"
                  onClick={() => updateSettings({ fontScale: Math.max(12, Math.round(14 * settings.fontScale) - 1) / 14 })}
                  disabled={settings.fontScale <= 12 / 14}
                  className="font-size-stepper-btn"
                >
                  <Minus size={14} />
                </button>
                <span className="font-size-stepper-value">{Math.round(14 * settings.fontScale)}px</span>
                <button
                  type="button"
                  onClick={() => updateSettings({ fontScale: Math.min(20, Math.round(14 * settings.fontScale) + 1) / 14 })}
                  disabled={settings.fontScale >= 20 / 14}
                  className="font-size-stepper-btn"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {activeColorPicker === 'base' && (
            <div className="flex items-center gap-3">
              <label className="settings-slider-label flex-shrink-0">Base Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.baseOpacity}
                onChange={e => updateSettings({ baseOpacity: parseFloat(e.target.value) })}
                className="base-opacity-slider"
                style={{ flex: 1 }}
              />
            </div>
          )}

          {activeColorPicker === 'background' && (
            <div className="color-picker-upload-row">
              <label className="color-picker-upload-button">
                <Upload size={16} />
                Upload Image
                <input type="file" accept="image/*" onChange={handleBackgroundImageUpload} className="hidden" />
              </label>
              {settings.backgroundImage && (
                <button onClick={() => setShowRemoveBgImageConfirm(true)} className="btn-icon flex-shrink-0" title="Remove Image" style={{ opacity: 0.7 }}>
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={cancelColorPicker} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={applyColor} accentColor={settings.customColors.accent} className="flex-1">Apply</Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        icon="🔄"
        title="Reset Theme?"
        description="Colors, backgrounds, shapes, mood labels, moon opacity, and all other theme variations will reset to defaults."
        confirmLabel="Reset"
        onConfirm={() => { resetTheme(); setShowResetConfirm(false); }}
        accentColor={settings.customColors.accent}
      />

      <ConfirmModal
        isOpen={showRemoveBgColorConfirm}
        onClose={() => setShowRemoveBgColorConfirm(false)}
        title="Remove Background Color?"
        description="Background color will fall back to using your base theme color."
        confirmLabel="Remove"
        onConfirm={() => {
          updateSettings({ backgroundColor: undefined });
          setTempColor(settings.customColors.base);
          setShowRemoveBgColorConfirm(false);
        }}
        accentColor={settings.customColors.accent}
      />

      <ConfirmModal
        isOpen={showRemoveBgImageConfirm}
        onClose={() => setShowRemoveBgImageConfirm(false)}
        title="Remove Background Image?"
        description="Deleting your uploaded background image will reveal the color underneath it."
        confirmLabel="Remove"
        onConfirm={() => { removeBackground(); setShowRemoveBgImageConfirm(false); }}
        accentColor={settings.customColors.accent}
      />
    </>
  );
};
