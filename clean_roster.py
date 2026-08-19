import pandas as pd
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def clean_roster():
    df = pd.read_excel('students.xlsx')
    
    def clean_handle(u):
        if not u or pd.isna(u):
            return None
        s = str(u).strip()
        if 'problemset' in s or 'profile/account' in s or s == 'https://leetcode.com/' or 'contest/weekly-contest' in s:
            return None
        if 'leetcode.com/u/' in s:
            return s.split('leetcode.com/u/')[-1].strip('/')
        if 'leetcode.com/' in s:
            parts = s.split('leetcode.com/')[-1].strip('/').split('/')
            return parts[0] if parts else None
        return s

    df['LeetCodeUsername'] = df['LeetCodeUsername'].apply(clean_handle)
    
    # Fix duplicate row 179 Shivan Sundar V
    if len(df) > 179 and df.loc[179, 'Name'] == 'SHIVAN SUNDAR V':
        df.loc[179, 'LeetCodeUsername'] = None
        
    df.to_excel('students.xlsx', index=False)
    print("✅ students.xlsx cleaned. Valid usernames:", df['LeetCodeUsername'].dropna().count())

if __name__ == "__main__":
    clean_roster()
