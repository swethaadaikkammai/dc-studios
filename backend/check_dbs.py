import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5432, user="postgres", password="VitDance2026", dbname="postgres", connect_timeout=5)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT datname, pg_database_size(datname) FROM pg_database WHERE datname NOT IN ('template0','template1','postgres') ORDER BY datname")
rows = cur.fetchall()
print("Databases found:")
for r in rows:
    print(f"  {r[0]}  ({r[1]//1024} KB)")
# Also check if vit_dance_booking has tables
for r in rows:
    if 'vit' in r[0].lower() or 'dance' in r[0].lower():
        try:
            c2 = psycopg2.connect(host="127.0.0.1", port=5432, user="postgres", password="VitDance2026", dbname=r[0], connect_timeout=5)
            cur2 = c2.cursor()
            cur2.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")
            tables = [t[0] for t in cur2.fetchall()]
            print(f"  Tables in {r[0]}: {tables}")
            c2.close()
        except Exception as e:
            print(f"  Could not inspect {r[0]}: {e}")
conn.close()
