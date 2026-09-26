import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import FileExport from './file-export';
import type { MoodEntry } from './types';
import { exportEntries, importEntries, mergeImportedEntries } from './utils';

const buildExportFileName = (): string => {
  const today = new Date();
  return `digimood-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.txt`;
};

const isCancellation = (error: unknown): boolean =>
  error instanceof Error && /cancel|dismiss|aborted/i.test(error.message);

const downloadBlob = (content: string, fileName: string): void => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportData = async (
  entries: MoodEntry[],
  showMessage: (message: string, type?: 'success' | 'error') => void,
  setIsExporting?: (v: boolean) => void,
): Promise<void> => {
  const valid = entries.filter(e => e.mood !== 'grey' || e.diary.trim());
  if (valid.length === 0) {
    showMessage('No entries to export.', 'error');
    return;
  }
  const fileName = buildExportFileName();
  const content = exportEntries(entries);

  if (Capacitor.isNativePlatform()) {
    setIsExporting?.(true);
    try {
      await FileExport.export({ data: content, filename: fileName });
      showMessage(`Exported ${valid.length} entries.`);
    } catch (error) {
      if (!isCancellation(error)) showMessage('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting?.(false);
    }
    return;
  }

  downloadBlob(content, fileName);
  showMessage(`Exported ${valid.length} entries.`);
};

export const shareData = async (
  entries: MoodEntry[],
  showMessage: (message: string, type?: 'success' | 'error') => void,
  setIsSharing?: (v: boolean) => void,
): Promise<void> => {
  const valid = entries.filter(e => e.mood !== 'grey' || e.diary.trim());
  if (valid.length === 0) {
    showMessage('No entries to share.', 'error');
    return;
  }
  const fileName = buildExportFileName();
  const content = exportEntries(valid);

  if (Capacitor.isNativePlatform()) {
    setIsSharing?.(true);
    try {
      await Filesystem.writeFile({ path: fileName, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
      await Share.share({ title: fileName, text: 'DigiMood export', url: uri, dialogTitle: 'Share export...' });
    } catch (error) {
      if (!isCancellation(error)) showMessage('Share failed. Please try again.', 'error');
    } finally {
      setIsSharing?.(false);
    }
    return;
  }

  if (navigator.share) {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], fileName, { type: 'text/plain' });
      await navigator.share({ files: [file], title: 'DigiMood export' });
    } catch {
      // user cancelled
    }
    return;
  }

  downloadBlob(content, fileName);
};

export const readImportFile = (
  file: File,
  setEntries: React.Dispatch<React.SetStateAction<MoodEntry[]>>,
  showMessage: (message: string, type?: 'success' | 'error') => void,
): void => {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    showMessage('Please select a .txt file.', 'error');
    return;
  }
  if (file.size > 1024 * 1024) {
    showMessage('File too large. Please use a file smaller than 1MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = importEntries(e.target?.result as string);
      setEntries(prev => mergeImportedEntries(prev, imported));
      showMessage(`Imported ${imported.length} entries.`);
    } catch (error) {
      showMessage(`Import failed: ${error instanceof Error ? error.message : 'Import failed.'}`, 'error');
    }
  };
  reader.onerror = () => showMessage('Error reading file. Please try again.', 'error');
  reader.readAsText(file);
};


