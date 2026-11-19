import os
import shutil
import zipfile
import subprocess
import sys

print("[1/5] Locating base APK and assets...")
src_apk = os.path.abspath("releases/android/app-release.apk")
new_assets_dir = os.path.abspath("frontend/android/app/src/main/assets/public")
output_apk = os.path.abspath("releases/android/Nandha_LeetCode_Intelligence_v4.5.7_latest.apk")
keystore = os.path.abspath("frontend/android/nandha-release-key.jks")
jarsigner = r"C:\Program Files\Java\jdk-21.0.11\bin\jarsigner.exe"

if not os.path.exists(src_apk):
    print(f"Error: Base APK not found at {src_apk}")
    sys.exit(1)

if not os.path.exists(new_assets_dir):
    print(f"Error: New assets directory not found at {new_assets_dir}")
    sys.exit(1)

print("[2/5] Creating updated APK archive with new web assets...")
with zipfile.ZipFile(src_apk, "r") as zin, zipfile.ZipFile(output_apk, "w", compression=zipfile.ZIP_DEFLATED) as zout:
    # Copy all files EXCEPT assets/public/* and META-INF/* signature files
    for item in zin.infolist():
        fn = item.filename
        if fn.startswith("assets/public/"):
            continue
        if fn.startswith("META-INF/") and (fn.endswith(".SF") or fn.endswith(".RSA") or fn.endswith(".MF") or fn.endswith(".DSA")):
            continue
        zout.writestr(item, zin.read(fn))
    
    # Inject all freshly compiled assets (strictly excluding binaries like apk/exe)
    count = 0
    for root, dirs, files in os.walk(new_assets_dir):
        for file in files:
            if file.endswith(".apk") or file.endswith(".exe") or file.endswith(".tmp") or file.endswith(".zip"):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, new_assets_dir).replace("\\", "/")
            arcname = "assets/public/" + rel_path
            zout.write(full_path, arcname)
            count += 1
    print(f"  Successfully injected {count} newly compiled assets (zero nested binaries).")

print("[3/5] Signing updated APK with official release keystore...")
sign_cmd = [
    jarsigner,
    "-sigalg", "SHA256withRSA",
    "-digestalg", "SHA-256",
    "-keystore", keystore,
    "-storepass", "NEC@2024secure",
    "-keypass", "NEC@2024secure",
    output_apk,
    "nandha-key"
]
res = subprocess.run(sign_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print(f"Signing failed with exit code {res.returncode}:\n{res.stderr}")
    sys.exit(1)
print("  jarsigner signing completed.")

print("[4/5] Verifying APK signature...")
ver_cmd = [jarsigner, "-verify", output_apk]
ver_res = subprocess.run(ver_cmd, capture_output=True, text=True)
print("  Verification output:", ver_res.stdout.strip())
if "jar verified" not in ver_res.stdout:
    print("Verification failed!")
    sys.exit(1)

print("[5/5] Deploying updated APK to distribution destinations...")

destinations = [
    "releases/android/Nandha-LeetCode-Tracker-Latest.apk",
    "releases/android/nandha-leetcode.apk",
    "frontend/public/Nandha_LeetCode_Intelligence_v4.5.7_latest.apk",
    "frontend/public/Nandha-LeetCode-Tracker-Latest.apk",
    "frontend/public/nandha-leetcode.apk",
    "frontend/dist/Nandha_LeetCode_Intelligence_v4.5.7_latest.apk",
    "frontend/dist/Nandha-LeetCode-Tracker-Latest.apk",
    "frontend/dist/nandha-leetcode.apk",
]

for dst in destinations:
    full_dst = os.path.abspath(dst)
    os.makedirs(os.path.dirname(full_dst), exist_ok=True)
    shutil.copy2(output_apk, full_dst)
    sz_mb = os.path.getsize(full_dst) / (1024 * 1024)
    print(f"  --> Updated: {dst} ({sz_mb:.2f} MB)")

print("\nAll done! Latest Android APK is fully updated, signed, and ready for use!")
