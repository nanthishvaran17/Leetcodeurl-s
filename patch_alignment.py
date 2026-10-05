import os
import glob

# Files to scan
files = glob.glob('*.py') + glob.glob('backend/**/*.py', recursive=True)

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = content
        
        # In generate_wc519_official_vs_sunday_report.py
        new_content = new_content.replace(
            "cell.alignment = align_left if c_idx in (3, 4, 6, 7, 16, 17, 21) else align_center",
            "cell.alignment = align_left if c_idx in (3, 4, 6, 7, 16, 17, 21) else align_center"
        )
        new_content = new_content.replace(
            "cell.alignment = align_left if c in (1, 3, 4, 6, 7, 17, 21) else align_center",
            "cell.alignment = align_left if c in (1, 3, 4, 6, 7, 17, 21) else align_center"
        )
        
        # In generate_premium_student_excel.py & generate_individual_student_excel.py
        new_content = new_content.replace(
            "cell.alignment = align_left if c_idx in (2, 3, 4, 6, 7, 17, 21) else align_center",
            "cell.alignment = align_left if c_idx in (2, 3, 4, 6, 7, 17, 21) else align_center"
        )
        
        # In backend/services/sheet_14_15_builder.py
        new_content = new_content.replace(
            "cell.alignment = ALIGN_LEFT if c in (2, 3, 4, 6, 7, 17, 21) else ALIGN_CENTER",
            "cell.alignment = ALIGN_LEFT if c in (2, 3, 4, 6, 7, 17, 21) else ALIGN_CENTER"
        )
        new_content = new_content.replace(
            "cell.alignment = ALIGN_LEFT if c in (2, 3, 4, 6, 7, 17, 21) else ALIGN_CENTER",
            "cell.alignment = ALIGN_LEFT if c in (2, 3, 4, 6, 7, 17, 21) else ALIGN_CENTER"
        )
        new_content = new_content.replace(
            "cell.alignment = ALIGN_LEFT if c in (1, 2, 3, 4, 6, 7, 17, 21) else ALIGN_CENTER",
            "cell.alignment = ALIGN_LEFT if c in (1, 2, 3, 4, 6, 7, 17, 21) else ALIGN_CENTER"
        )
        
        # In run_full_cyber_iot_scan_and_email.py
        new_content = new_content.replace(
            "cell.alignment = align_left if col_idx in (2, 3, 4, 6, 7, 17, 21) else align_center",
            "cell.alignment = align_left if col_idx in (2, 3, 4, 6, 7, 17, 21) else align_center"
        )
        new_content = new_content.replace(
            "cell.alignment = align_left if col_idx in (2, 3, 4, 5, 6, 7, 17, 21) else align_center",
            "cell.alignment = align_left if col_idx in (2, 3, 4, 5, 6, 7, 17, 21) else align_center"
        )

        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Patched alignment in {filepath}")
            
    except Exception as e:
        pass

print("Done patching alignment globally.")
