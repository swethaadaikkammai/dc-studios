import psycopg2

conn = psycopg2.connect(host="127.0.0.1", port=5432, user="postgres", password="VitDance2026", dbname="vit_dance_booking", connect_timeout=5)
conn.autocommit = True
cur = conn.cursor()
cur.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
print("btree_gist extension created")
cur.execute("SELECT extname FROM pg_extension WHERE extname='btree_gist'")
print("Verified:", cur.fetchone())
conn.close()
