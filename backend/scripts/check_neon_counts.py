import os
import sys
from sqlalchemy import create_engine, text

PG_URL = "postgresql://neondb_owner:npg_5oAmt0ICFKMT@ep-falling-pine-ae9dk8zu.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def check():
    engine = create_engine(PG_URL, echo=False)
    with engine.connect() as conn:
        res = conn.execute(text("""
            SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
            FROM (
              SELECT table_name,
                     query_to_xml(format('select count(*) as cnt from %I', table_name), false, false, '') as xml_count
              FROM information_schema.tables
              WHERE table_schema = 'public'
            ) t
            WHERE (xpath('/row/cnt/text()', xml_count))[1]::text::int > 0
            ORDER BY row_count DESC;
        """))
        rows = res.fetchall()
        print("TABLES WITH ROWS IN NEON POSTGRES:")
        for r in rows:
            print(f"  {r[0]:<40} : {r[1]} rows")

if __name__ == "__main__":
    check()
