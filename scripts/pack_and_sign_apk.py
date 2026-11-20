import os
import zipfile
import shutil
import subprocess

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dist_dir = os.path.join(root, "frontend", "dist")
    base_apk = os.path.join(root, "releases", "android", "Nandha_LeetCode_Intelligence_v4.6.1_latest.apk")
    temp_apk = os.path.join(root, "releases", "android", "temp_unsigned.apk")
    v462_apk = os.path.join(root, "releases", "android", "Nandha_LeetCode_Intelligence_v4.6.2_latest.apk")
    keystore = os.path.join(root, "frontend", "android", "nandha-release-key.jks")
    jarsigner = r"C:\Program Files\Java\jdk-21.0.11\bin\jarsigner.exe"

    print("Reading base APK:", base_apk)
    with zipfile.ZipFile(base_apk, 'r') as zin, zipfile.ZipFile(temp_apk, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            # Skip old signatures and old public assets
            if item.filename.startswith("META-INF/") and (item.filename.endswith(".SF") or item.filename.endswith(".RSA") or item.filename.endswith("MANIFEST.MF")):
                continue
            if item.filename.startswith("assets/public/"):
                continue
            zout.writestr(item, zin.read(item.filename))

        # Add updated assets from frontend/dist
        print("Injecting latest assets from:", dist_dir)
        for dirpath, _, filenames in os.walk(dist_dir):
            for fname in filenames:
                if fname.endswith(".apk") or fname.endswith(".exe"):
                    continue
                fpath = os.path.join(dirpath, fname)
                rel_path = os.path.relpath(fpath, dist_dir).replace("\\", "/")
                arcname = "assets/public/" + rel_path
                zout.write(fpath, arcname)

    print("Signing APK with jarsigner...")
    if os.path.exists(v462_apk):
        os.remove(v462_apk)
    shutil.move(temp_apk, v462_apk)

    cmd = [
        jarsigner,
        "-keystore", keystore,
        "-storepass", "NEC@2024secure",
        "-keypass", "NEC@2024secure",
        "-sigalg", "SHA256withRSA",
        "-digestalg", "SHA-256",
        v462_apk,
        "nandha-key"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("jarsigner output:", res.stdout)
    if res.returncode != 0:
        print("jarsigner error:", res.stderr)
        raise RuntimeError("Failed to sign APK")

    verify_cmd = [jarsigner, "-verify", v462_apk]
    verify_res = subprocess.run(verify_cmd, capture_output=True, text=True)
    print("Verification:", verify_res.stdout)
    if "jar verified" not in verify_res.stdout:
        raise RuntimeError("APK verification failed: " + verify_res.stdout)

    # Copy to all standard output locations
    destinations = [
        os.path.join(root, "releases", "android", "Nandha-LeetCode-Tracker-Latest.apk"),
        os.path.join(root, "releases", "android", "nandha-leetcode.apk"),
        os.path.join(root, "frontend", "dist", "Nandha_LeetCode_Intelligence_v4.6.2_latest.apk"),
        os.path.join(root, "frontend", "dist", "Nandha-LeetCode-Tracker-Latest.apk"),
        os.path.join(root, "frontend", "dist", "nandha-leetcode.apk"),
        os.path.join(root, "frontend", "public", "Nandha_LeetCode_Intelligence_v4.6.2_latest.apk"),
        os.path.join(root, "frontend", "public", "Nandha-LeetCode-Tracker-Latest.apk"),
        os.path.join(root, "frontend", "public", "nandha-leetcode.apk"),
    ]

    for dest in destinations:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(v462_apk, dest)
        print("Copied APK to:", dest)

    print("\nSUCCESS: All v4.6.2 APKs compiled, signed, verified, and placed successfully!")

if __name__ == "__main__":
    main()
