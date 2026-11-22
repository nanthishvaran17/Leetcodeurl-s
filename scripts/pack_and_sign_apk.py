import os
import zipfile
import shutil
import subprocess

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dist_dir = os.path.join(root, "frontend", "dist")
    base_apk = os.path.join(root, "releases", "android", "Nandha_LeetCode_Intelligence_v4.6.2_latest.apk")
    temp_apk = os.path.join(root, "releases", "android", "temp_unsigned_v463.apk")
    v463_apk = os.path.join(root, "releases", "android", "Nandha_LeetCode_Intelligence_v4.6.3_latest.apk")
    keystore = os.path.join(root, "frontend", "android", "nandha-release-key.jks")
    java_exe = r"C:\Program Files\JetBrains\IntelliJ IDEA Community Edition 2025.2.6.3\jbr\bin\java.exe"
    uber_jar = os.path.join(root, "tools", "uber-apk-signer.jar")

    if not os.path.exists(base_apk):
        raise FileNotFoundError(f"Base APK not found at: {base_apk}")

    if not os.path.exists(java_exe):
        raise FileNotFoundError(f"Java runtime not found at: {java_exe}")

    if not os.path.exists(uber_jar):
        raise FileNotFoundError(f"Uber APK Signer not found at: {uber_jar}")

    print("Step 1: Reading base APK and creating clean container from:", base_apk)
    if os.path.exists(temp_apk):
        os.remove(temp_apk)

    with zipfile.ZipFile(base_apk, 'r') as zin, zipfile.ZipFile(temp_apk, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            # Skip old signatures and old bundled web assets
            if item.filename.startswith("META-INF/") and (
                item.filename.endswith(".SF") or item.filename.endswith(".RSA") or item.filename.endswith("MANIFEST.MF")
            ):
                continue
            if item.filename.startswith("assets/public/"):
                continue
            zout.writestr(item, zin.read(item.filename))

        # Add updated assets from frontend/dist
        print("Step 2: Injecting compiled production web assets from:", dist_dir)
        count = 0
        for dirpath, _, filenames in os.walk(dist_dir):
            for fname in filenames:
                if fname.endswith(".apk") or fname.endswith(".exe") or fname.endswith(".tmp"):
                    continue
                fpath = os.path.join(dirpath, fname)
                rel_path = os.path.relpath(fpath, dist_dir).replace("\\", "/")
                arcname = "assets/public/" + rel_path
                zout.write(fpath, arcname)
                count += 1
        print(f"  Injected {count} production assets into assets/public/")

    if os.path.exists(v463_apk):
        os.remove(v463_apk)
    shutil.move(temp_apk, v463_apk)

    print("Step 3: Signing and zip-aligning APK (v1, v2, v3 schemes) using uber-apk-signer...")
    sign_cmd = [
        java_exe, "-jar", uber_jar,
        "-a", v463_apk,
        "--ks", keystore,
        "--ksAlias", "nandha-key",
        "--ksPass", "NEC@2024secure",
        "--ksKeyPass", "NEC@2024secure",
        "--allowResign",
        "--overwrite",
        "--verbose"
    ]
    res = subprocess.run(sign_cmd, capture_output=True, text=True)
    print("uber-apk-signer output:\n", res.stdout)
    if res.returncode != 0:
        print("Signing stderr:\n", res.stderr)
        raise RuntimeError(f"Failed to sign APK (exit code {res.returncode})")

    print("Step 4: Verifying APK signature scheme...")
    ver_cmd = [java_exe, "-jar", uber_jar, "-y", "-a", v463_apk]
    ver_res = subprocess.run(ver_cmd, capture_output=True, text=True)
    print("Verification output:\n", ver_res.stdout)
    if "DOES NOT VERIFY" in ver_res.stdout or ("VERIFIES" not in ver_res.stdout and "verified" not in ver_res.stdout.lower()):
        raise RuntimeError("APK verification failed: " + ver_res.stdout)

    print("Step 5: Deploying signed v4.6.3 APK to all distribution locations...")
    destinations = [
        os.path.join(root, "releases", "android", "Nandha-LeetCode-Tracker-Latest.apk"),
        os.path.join(root, "releases", "android", "nandha-leetcode.apk"),
        os.path.join(root, "frontend", "dist", "Nandha_LeetCode_Intelligence_v4.6.3_latest.apk"),
        os.path.join(root, "frontend", "dist", "Nandha-LeetCode-Tracker-Latest.apk"),
        os.path.join(root, "frontend", "dist", "nandha-leetcode.apk"),
        os.path.join(root, "frontend", "public", "Nandha_LeetCode_Intelligence_v4.6.3_latest.apk"),
        os.path.join(root, "frontend", "public", "Nandha-LeetCode-Tracker-Latest.apk"),
        os.path.join(root, "frontend", "public", "nandha-leetcode.apk"),
    ]

    for dest in destinations:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(v463_apk, dest)
        size_mb = os.path.getsize(dest) / (1024 * 1024)
        print(f"  Copied to: {dest} ({size_mb:.2f} MB)")

    print("\nSUCCESS: Nandha LeetCode Intelligence v4.6.3 APK built, signed, verified, and deployed successfully!")

if __name__ == "__main__":
    main()
