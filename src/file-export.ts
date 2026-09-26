import { registerPlugin } from '@capacitor/core';

export interface FileExportOptions {
  data: string;
  filename: string;
}

export interface FileExportPlugin {
  export(options: FileExportOptions): Promise<void>;
}

const FileExport = registerPlugin<FileExportPlugin>('FileExport', {
  web: {
    export: async () => {},
  },
});

export default FileExport;
