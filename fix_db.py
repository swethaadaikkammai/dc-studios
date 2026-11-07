import psycopg2

new_password = "VitDance2026"
print("Trying trust mode...")
try:
    conn = psycopg2.connect(host="127.0.0.1", port=5432, user="postgres", password="", dbname="postgres", connect_timeout=5)
    print("Connected in trust mode!")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("ALTER USER postgres WITH PASSWORD '" + new_password + "'")
    print("Password reset to: " + new_password)
    cur.execute("SELECT 1 FROM pg_database WHERE datname='vit_dance_booking'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE vit_dance_booking")
        print("Created DB: vit_dance_booking")
    else:
        print("DB already exists")
    conn.close()
except Exception as e:
    print("Trust failed: " + str(e)[:100])
    print("Trying VitDance2026...")
    try:
        conn2 = psycopg2.connect(host="127.0.0.1", port=5432, user="postgres", password=new_password, dbname="postgres", connect_timeout=5)
        conn2.autocommit = True
        cur2 = conn2.cursor()
        cur2.execute("SELECT 1 FROM pg_database WHERE datname='vit_dance_booking'")
        if not cur2.fetchone():
            cur2.execute("CREATE DATABASE vit_dance_booking")
            print("Created DB!")
        else:
            print("DB exists. Connection OK with VitDance2026")
        conn2.close()
    except Exception as e2:
        print("Failed: " + str(e2)[:150])
