package dev.shahroz.pigeon;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.util.ArrayDeque;
import java.util.Deque;

/** Lets the web app pick a whole folder (Storage Access Framework), read its files in chunks and open received files. */
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri tree = result.getData().getData();
        ContentResolver cr = getContext().getContentResolver();
        try {
            cr.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {}

        String rootDocId = DocumentsContract.getTreeDocumentId(tree);
        String rootName = queryName(cr, DocumentsContract.buildDocumentUriUsingTree(tree, rootDocId));
        if (rootName == null || rootName.isEmpty()) {
            String[] parts = rootDocId.split("[:/]");
            rootName = parts.length > 0 ? parts[parts.length - 1] : "Folder";
        }

        JSArray files = new JSArray();
        Deque<String[]> stack = new ArrayDeque<>(); // [docId, relPrefix]
        stack.push(new String[]{rootDocId, ""});
        int guard = 0;
        while (!stack.isEmpty() && guard++ < 20000) {
            String[] cur = stack.pop();
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, cur[0]);
            Cursor c = null;
            try {
                c = cr.query(childrenUri, new String[]{
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE,
                        DocumentsContract.Document.COLUMN_SIZE}, null, null, null);
                if (c == null) continue;
                while (c.moveToNext()) {
                    String docId = c.getString(0);
                    String name = c.getString(1);
                    String mime = c.getString(2);
                    long size = c.isNull(3) ? 0 : c.getLong(3);
                    if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                        stack.push(new String[]{docId, cur[1] + name + "/"});
                    } else {
                        JSObject f = new JSObject();
                        f.put("name", name);
                        f.put("relPath", cur[1] + name);
                        f.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, docId).toString());
                        f.put("size", size);
                        f.put("mime", mime == null ? "" : mime);
                        files.put(f);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.close();
            }
        }
        JSObject ret = new JSObject();
        ret.put("name", rootName);
        ret.put("files", files);
        call.resolve(ret);
    }

    private String queryName(ContentResolver cr, Uri uri) {
        Cursor c = null;
        try {
            c = cr.query(uri, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    /** Reads `length` bytes from `offset` of a content:// or file:// uri and returns them base64 encoded. */
    @PluginMethod
    public void readChunk(PluginCall call) {
        String uriStr = call.getString("uri");
        long offset = call.getLong("offset", 0L);
        int length = call.getInt("length", 512 * 1024);
        if (uriStr == null) { call.reject("uri required"); return; }
        ParcelFileDescriptor pfd = null;
        FileInputStream in = null;
        try {
            Uri uri = Uri.parse(uriStr);
            if ("file".equals(uri.getScheme())) {
                in = new FileInputStream(new File(uri.getPath()));
            } else {
                pfd = getContext().getContentResolver().openFileDescriptor(uri, "r");
                if (pfd == null) { call.reject("cannot open"); return; }
                in = new FileInputStream(pfd.getFileDescriptor());
            }
            FileChannel ch = in.getChannel();
            ch.position(offset);
            byte[] buf = new byte[length];
            int total = 0;
            while (total < length) {
                int n = in.read(buf, total, length - total);
                if (n < 0) break;
                total += n;
            }
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(buf, 0, total, Base64.NO_WRAP));
            ret.put("length", total);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("read failed: " + e.getMessage());
        } finally {
            try { if (in != null) in.close(); } catch (IOException ignored) {}
            try { if (pfd != null) pfd.close(); } catch (IOException ignored) {}
        }
    }

    /** Opens a received file with the system's default app. */
    @PluginMethod
    public void openFile(PluginCall call) {
        String p = call.getString("path");
        if (p == null) { call.reject("path required"); return; }
        try {
            Uri parsed = Uri.parse(p);
            File file = new File("file".equals(parsed.getScheme()) ? parsed.getPath() : p);
            Uri content = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            String ext = MimeTypeMap.getFileExtensionFromUrl(Uri.fromFile(file).toString());
            String mime = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
            if (mime == null) mime = "*/*";
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(content, mime);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(Intent.createChooser(intent, "Open with"));
            call.resolve();
        } catch (Exception e) {
            call.reject("cannot open: " + e.getMessage());
        }
    }
}
