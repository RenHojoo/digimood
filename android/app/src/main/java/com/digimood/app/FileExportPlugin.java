package com.digimood.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {

    private String tempFilePath;

    @Override
    protected Bundle saveInstanceState() {
        Bundle state = new Bundle();
        if (tempFilePath != null) {
            state.putString("tempFilePath", tempFilePath);
        }
        return state;
    }

    @Override
    protected void restoreState(Bundle state) {
        if (state != null) {
            tempFilePath = state.getString("tempFilePath");
        }
    }

    @PluginMethod
    public void export(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename", "export.txt");
        if (data == null) {
            call.reject("No data provided");
            return;
        }

        try {
            File tempFile = new File(getContext().getCacheDir(), "digimood_export.tmp");
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(data.getBytes(StandardCharsets.UTF_8));
            }
            tempFilePath = tempFile.getAbsolutePath();

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            startActivityForResult(call, intent, "onExportResult");
        } catch (Exception e) {
            call.reject("Failed to prepare export", e);
        }
    }

    @ActivityCallback
    public void onExportResult(PluginCall call, ActivityResult result) {
        if (tempFilePath == null) {
            call.reject("Export session expired");
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            cleanupTempFile();
            call.reject("Export cancelled");
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            cleanupTempFile();
            call.reject("No file selected");
            return;
        }

        try {
            File tempFile = new File(tempFilePath);
            try (FileInputStream fis = new FileInputStream(tempFile);
                 OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
                if (os == null) {
                    call.reject("Could not open destination file");
                    return;
                }
                byte[] buffer = new byte[8192];
                int len;
                while ((len = fis.read(buffer)) != -1) {
                    os.write(buffer, 0, len);
                }
            }
            cleanupTempFile();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to write export file", e);
        }
    }

    private void cleanupTempFile() {
        if (tempFilePath != null) {
            new File(tempFilePath).delete();
            tempFilePath = null;
        }
    }
}
