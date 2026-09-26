package com.digimood.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {

    private String exportContent;

    @Override
    protected Bundle saveInstanceState() {
        Bundle state = super.saveInstanceState();
        if (state == null) {
            state = new Bundle();
        }
        if (exportContent != null) {
            state.putString("exportContent", exportContent);
        }
        return state;
    }

    @Override
    protected void restoreState(Bundle state) {
        super.restoreState(state);
        if (state != null) {
            exportContent = state.getString("exportContent");
        }
    }

    @PluginMethod
    public void export(PluginCall call) {
        String content = call.getString("content");
        String filename = call.getString("filename", "export.txt");
        if (content == null) {
            call.reject("No content provided");
            return;
        }

        exportContent = content;

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onExportResult");
    }

    private void writeContent(Uri destUri) {
        if (exportContent == null) return;
        try (OutputStream os = getContext().getContentResolver().openOutputStream(destUri)) {
            if (os != null) {
                os.write(exportContent.getBytes("UTF-8"));
                os.flush();
            }
        } catch (Exception e) {
            // Best effort
        } finally {
            exportContent = null;
        }
    }

    @ActivityCallback
    public void onExportResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            exportContent = null;
            if (call != null) call.reject("Export cancelled");
            return;
        }

        Uri destUri = result.getData().getData();
        if (destUri == null) {
            exportContent = null;
            if (call != null) call.reject("No file selected");
            return;
        }

        // If the PluginCall is null (activity was recreated), still write the file.
        if (call == null) {
            writeContent(destUri);
            return;
        }

        if (exportContent == null) {
            call.reject("Export session expired");
            return;
        }

        try (OutputStream os = getContext().getContentResolver().openOutputStream(destUri)) {
            if (os == null) {
                exportContent = null;
                call.reject("Could not open destination file");
                return;
            }
            os.write(exportContent.getBytes("UTF-8"));
            os.flush();
            exportContent = null;
            call.resolve();
        } catch (Exception e) {
            exportContent = null;
            call.reject("Failed to write export file", e);
        }
    }
}
