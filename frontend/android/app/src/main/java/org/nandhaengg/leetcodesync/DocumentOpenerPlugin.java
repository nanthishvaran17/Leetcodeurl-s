package org.nandhaengg.leetcodesync;

import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.List;

@CapacitorPlugin(name = "DocumentOpener")
public class DocumentOpenerPlugin extends Plugin {

    @PluginMethod
    public void openDocument(PluginCall call) {
        String rawPath = call.getString("path");
        String mimeType = call.getString("mimeType", "*/*");
        String filename = call.getString("filename", "document");

        if (rawPath == null || rawPath.trim().isEmpty()) {
            call.reject("PATH_REQUIRED", "Must provide a valid file path");
            return;
        }

        try {
            // Normalize MIME type specifically for Excel / Office documents
            String lowerName = filename.toLowerCase();
            if (mimeType == null || mimeType.equals("*/*") || mimeType.equals("application/octet-stream") || mimeType.isEmpty()) {
                if (lowerName.endsWith(".xlsx")) {
                    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                } else if (lowerName.endsWith(".xls")) {
                    mimeType = "application/vnd.ms-excel";
                } else if (lowerName.endsWith(".csv")) {
                    mimeType = "text/csv";
                } else if (lowerName.endsWith(".pdf")) {
                    mimeType = "application/pdf";
                } else if (lowerName.endsWith(".docx")) {
                    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }
            }

            Uri parsedUri = Uri.parse(rawPath);
            Uri contentUri;

            if (rawPath.startsWith("content://")) {
                contentUri = parsedUri;
            } else {
                String cleanPath = parsedUri.getPath() != null ? parsedUri.getPath() : rawPath.replace("file://", "");
                File targetFile = new File(cleanPath);

                // Fallback search in cache, files, externalCache, and externalFiles if path not directly found
                if (!targetFile.exists() || targetFile.length() == 0) {
                    File cacheCandidate = new File(getContext().getCacheDir(), filename);
                    if (cacheCandidate.exists() && cacheCandidate.length() > 0) {
                        targetFile = cacheCandidate;
                    } else {
                        File filesCandidate = new File(getContext().getFilesDir(), filename);
                        if (filesCandidate.exists() && filesCandidate.length() > 0) {
                            targetFile = filesCandidate;
                        } else if (getContext().getExternalCacheDir() != null) {
                            File extCacheCandidate = new File(getContext().getExternalCacheDir(), filename);
                            if (extCacheCandidate.exists() && extCacheCandidate.length() > 0) {
                                targetFile = extCacheCandidate;
                            }
                        }
                    }
                }

                if (!targetFile.exists() || targetFile.length() == 0) {
                    call.reject("FILE_NOT_FOUND", "File is no longer available.");
                    return;
                }

                String authority = getContext().getPackageName() + ".fileprovider";
                contentUri = FileProvider.getUriForFile(getContext(), authority, targetFile);
            }

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(contentUri, mimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Grant read permission explicitly to any apps that can handle this intent (Excel, Sheets, etc.)
            PackageManager pm = getContext().getPackageManager();
            List<ResolveInfo> resInfoList = pm.queryIntentActivities(viewIntent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                getContext().grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            Intent chooserIntent = Intent.createChooser(viewIntent, "Open " + filename);
            chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(chooserIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("OPEN_FAILED", "Failed to open document: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String base64Data = call.getString("data");
        String filename = call.getString("filename", "report.xlsx");
        String mimeType = call.getString("mimeType", "*/*");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("DATA_REQUIRED", "No file data provided");
            return;
        }

        try {
            String lowerName = filename.toLowerCase();
            if (mimeType == null || mimeType.equals("*/*") || mimeType.equals("application/octet-stream") || mimeType.isEmpty()) {
                if (lowerName.endsWith(".xlsx")) {
                    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                } else if (lowerName.endsWith(".xls")) {
                    mimeType = "application/vnd.ms-excel";
                } else if (lowerName.endsWith(".csv")) {
                    mimeType = "text/csv";
                } else if (lowerName.endsWith(".pdf")) {
                    mimeType = "application/pdf";
                } else if (lowerName.endsWith(".docx")) {
                    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }
            }

            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

            // 1. Cache copy for guaranteed local FileProvider resolution
            File cacheFile = new File(getContext().getCacheDir(), filename);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(fileBytes);
                fos.flush();
            }

            Uri publicUri = null;

            // 2. Official Android Public Downloads (MediaStore for Android 10+, direct Environment for Android 9-)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                publicUri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (publicUri != null) {
                    try (OutputStream os = getContext().getContentResolver().openOutputStream(publicUri)) {
                        if (os != null) {
                            os.write(fileBytes);
                            os.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContext().getContentResolver().update(publicUri, values, null, null);
                }
            } else {
                File publicDownloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (publicDownloadDir != null && (publicDownloadDir.exists() || publicDownloadDir.mkdirs())) {
                    File publicFile = new File(publicDownloadDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(publicFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(
                        getContext(),
                        new String[]{publicFile.getAbsolutePath()},
                        new String[]{mimeType},
                        null
                    );
                    publicUri = Uri.fromFile(publicFile);
                }
            }

            String authority = getContext().getPackageName() + ".fileprovider";
            Uri fileProviderUri = FileProvider.getUriForFile(getContext(), authority, cacheFile);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", cacheFile.getAbsolutePath());
            ret.put("fileUri", fileProviderUri.toString());
            ret.put("publicUri", publicUri != null ? publicUri.toString() : fileProviderUri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("SAVE_FAILED", "Failed to save file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void fileExists(PluginCall call) {
        String rawPath = call.getString("path");
        String filename = call.getString("filename", "");

        if (rawPath == null || rawPath.trim().isEmpty()) {
            call.resolve(new JSObject().put("exists", false));
            return;
        }

        try {
            String cleanPath = rawPath.replace("file://", "");
            File targetFile = new File(cleanPath);

            if (!targetFile.exists() && !filename.isEmpty()) {
                File cacheCandidate = new File(getContext().getCacheDir(), filename);
                if (cacheCandidate.exists() && cacheCandidate.length() > 0) {
                    targetFile = cacheCandidate;
                }
            }

            boolean exists = targetFile.exists() && targetFile.length() > 0;
            JSObject ret = new JSObject();
            ret.put("exists", exists);
            ret.put("size", targetFile.length());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("exists", false);
            call.resolve(ret);
        }
    }
}
