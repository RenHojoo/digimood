import React, { useState, useRef, useCallback } from 'react';
import { Download, Upload, Trash2, Share2 } from 'lucide-react';
import { Button, ConfirmModal } from './ui';
import { useEntries } from './app-context';
import { exportData, shareData, readImportFile } from './data-transfer';

export const DataManagementSection: React.FC<{
  onDeleteAllData: () => void;
  showMessage: (message: string, type?: 'success' | 'error') => void;
  accentColor: string;
}> = ({ onDeleteAllData, showMessage, accentColor }) => {
  const [entries, setEntries] = useEntries();
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hiddenImportInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    exportData(entries, showMessage, setIsExporting);
  }, [entries, showMessage]);

  const handleShare = useCallback(() => {
    shareData(entries, showMessage, setIsSharing);
  }, [entries, showMessage]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readImportFile(file, setEntries, showMessage);
    event.target.value = '';
    setShowImportConfirm(false);
  }, [setEntries, showMessage]);

  const handleImport = useCallback(() => {
    setShowImportConfirm(false);
    if (hiddenImportInputRef.current) {
      hiddenImportInputRef.current.value = '';
      hiddenImportInputRef.current.click();
    }
  }, []);

  return (
    <>
      <div className="settings-section">
        <h3 className="section-title mb-4">Data Management</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || isSharing}
              className="flex-1 flex-center gap-2"
            >
              <Download size={16} />
              {isExporting ? 'Exporting...' : 'Export Data'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              disabled={isExporting || isSharing}
              className="flex-1 flex-center gap-2"
            >
              <Share2 size={16} />
              {isSharing ? 'Uploading...' : 'Upload Data'}
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowImportConfirm(true)}
            className="w-full flex-center gap-2"
          >
            <Upload size={16} />
            Import Data
          </Button>
          <input
            ref={hiddenImportInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      <div className="settings-section">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          accentColor={accentColor}
          className="w-full flex-center gap-2"
        >
          <Trash2 size={16} />
          Delete Data
        </Button>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        icon="⚠️"
        title="Delete All Data?"
        description="All your entries will be permanently deleted from this device. This action cannot be undone (make sure to export a backup)!"
        confirmLabel="Delete All"
        onConfirm={() => {
          onDeleteAllData();
          setShowDeleteConfirm(false);
          showMessage('All entries deleted.');
        }}
        accentColor={accentColor}
      />

      <ConfirmModal
        isOpen={showImportConfirm}
        onClose={() => setShowImportConfirm(false)}
        icon="📁"
        title="Import .TXT File?"
        description="Choose a .txt file to upload to this device. Entries with the same date will be replaced. This action cannot be undone."
        confirmLabel="Select File"
        onConfirm={handleImport}
        accentColor={accentColor}
      />
    </>
  );
};
