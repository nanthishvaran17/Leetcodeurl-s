package org.nandhaengg.leetcodesync;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

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
            Uri contentUri = FileProvider.getUriForFile(getContext(), authority, targetFile);

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(contentUri, mimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Grant read permission explicitly to any apps that can handle this intent (Excel, Sheets, etc.)
            android.content.pm.PackageManager pm = getContext().getPackageManager();
            java.util.List<android.content.pm.ResolveInfo> resInfoList = pm.queryIntentActivities(viewIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
            for (android.content.pm.ResolveInfo resolveInfo : resInfoList) {
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
    public void fileExists(PluginCall call) {
        String rawPath = call.getString("path");
        String filename = call.getString("filename", "");

        if (rawPath == null || rawPath.trim().isEmpty()) {
            call.resolve(new com.getcapacitor.JSObject().put("exists", false));
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
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("exists", exists);
            ret.put("size", targetFile.length());
            call.resolve(ret);
        } catch (Exception e) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("exists", false);
            call.resolve(ret);
        }
    }
}
