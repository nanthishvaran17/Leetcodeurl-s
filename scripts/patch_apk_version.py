import os
import struct

def patch_manifest(manifest_bytes, new_version_code=103, new_version_name="4.6.3"):
    b = bytearray(manifest_bytes)
    
    # 1. Locate versionCode pattern:
    # ans=114 (android ns), aname=20 (versionCode), raw_val=0xFFFFFFFF, tv_size=8, res0=0, dtype=16 (int)
    pattern = struct.pack('<IIIHBB', 114, 20, 0xFFFFFFFF, 8, 0, 16)
    idx = b.find(pattern)
    if idx == -1:
        # Fallback search without fixed namespace index
        for i in range(len(b) - 20):
            ans, aname, raw_val, tv_size, res0, dtype, dval = struct.unpack('<IIIHBBI', b[i:i+20])
            if aname == 20 and dtype == 16 and tv_size == 8:
                idx = i
                break

    if idx == -1:
        raise RuntimeError("Could not find versionCode attribute in AndroidManifest.xml!")

    old_vc, = struct.unpack('<I', b[idx+16:idx+20])
    struct.pack_into('<I', b, idx+16, new_version_code)
    print(f"Patched AndroidManifest.xml versionCode: {old_vc} -> {new_version_code} (offset {idx+16})")

    # 2. Patch versionName:
    # "4.5.7" is stored in UTF-16LE in string pool (10 bytes)
    old_vn_u16 = "4.5.7".encode("utf-16le")
    new_vn_u16 = new_version_name.encode("utf-16le")
    if len(old_vn_u16) == len(new_vn_u16):
        pos16 = b.find(old_vn_u16)
        if pos16 != -1:
            b[pos16:pos16+len(new_vn_u16)] = new_vn_u16
            print(f"Patched AndroidManifest.xml UTF-16LE versionName: '4.5.7' -> '{new_version_name}' (offset {pos16})")

    return bytes(b)

if __name__ == "__main__":
    import zipfile
    with zipfile.ZipFile("releases/android/Nandha_LeetCode_Intelligence_v4.6.3_latest.apk", "r") as z:
        raw_manifest = z.read("AndroidManifest.xml")
    patched = patch_manifest(raw_manifest, 103, "4.6.3")
    print(f"Original manifest length: {len(raw_manifest)}, Patched manifest length: {len(patched)}")
