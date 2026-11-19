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

print("[3/5] Aligning and signing APK with APK Signature Scheme v2 & v3 (uber-apk-signer)...")
uber_jar = os.path.abspath("tools/uber-apk-signer.jar")
if not os.path.exists(uber_jar):
    import urllib.request
    print(f"  Downloading uber-apk-signer to {uber_jar}...")
    os.makedirs(os.path.dirname(uber_jar), exist_ok=True)
    urllib.request.urlretrieve("https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar", uber_jar)
sign_cmd = [
    "java", "-jar", uber_jar,
    "-a", output_apk,
    "--ks", keystore,
    "--ksAlias", "nandha-key",
    "--ksPass", "NEC@2024secure",
    "--ksKeyPass", "NEC@2024secure",
    "--allowResign",
    "--overwrite",
    "--verbose"
]
res = subprocess.run(sign_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print(f"Signing failed with exit code {res.returncode}:\n{res.stdout}\n{res.stderr}")
    sys.exit(1)
print("  zipalign and v2/v3 signing completed successfully.")

print("[4/5] Verifying APK signature scheme...")
ver_cmd = ["java", "-jar", uber_jar, "-y", "-a", output_apk, "--verbose"]
ver_res = subprocess.run(ver_cmd, capture_output=True, text=True)
if "signature verified" not in ver_res.stdout or "zipalign verified" not in ver_res.stdout:
    print(f"Verification failed:\n{ver_res.stdout}")
    sys.exit(1)
print("  Verified: zipalign OK, signature scheme v2/v3 OK!")

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
