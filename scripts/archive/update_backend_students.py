with open('backend/routes/students.py', 'r', encoding='utf-8') as f:
    code = f.read()

old_lookup = """                dept_lookup = {
                    "CSE(CS)": 1, "CS": 1, "CYBER": 1, "CYBER SECURITY": 1,
                    "CSE(IOT)": 2, "IOT": 2, "INTERNET OF THINGS": 2,
                    "IT": 4, "INFORMATION TECHNOLOGY": 4,
                    "CSE": 5, "AIDS": 10, "ECE": 12, "AGRI": 17, "MECH": 18, "CIVIL": 19, "EEE": 20
                }"""

new_lookup = """                dept_lookup = {
                    "CSE(CS)": 1, "CS": 1, "CYBER": 1, "CYBER SECURITY": 1, "CSE_CS": 1, "CSE-CS": 1, "CSE (CS)": 1,
                    "CSE(IOT)": 2, "IOT": 2, "INTERNET OF THINGS": 2, "CSE_IOT": 2, "CSE-IOT": 2, "CSE (IOT)": 2,
                    "IT": 4, "INFORMATION TECHNOLOGY": 4,
                    "CSE": 5, "AIDS": 10, "ECE": 12, "AGRI": 17, "MECH": 18, "CIVIL": 19, "EEE": 20
                }"""

code = code.replace(old_lookup, new_lookup, 1)

with open('backend/routes/students.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated backend/routes/students.py successfully!")
