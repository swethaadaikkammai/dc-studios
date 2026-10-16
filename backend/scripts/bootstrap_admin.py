import sys
import os
import getpass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password


def bootstrap_admin():
    db = SessionLocal()
    try:
        username = os.environ.get("BOOTSTRAP_ADMIN_USERNAME")
        email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
        password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")

        if not username:
            username = input("Enter Administrator Username: ").strip()
        if not email:
            email = input("Enter Administrator Email: ").strip()
        if not password:
            password = getpass.getpass("Enter Administrator Password: ").strip()

        if not username or not email or not password:
            print("Error: Username, email, and password cannot be empty.")
            sys.exit(1)

        existing = db.query(User).filter((User.username == username) | (User.email == email)).first()
        if existing:
            print(f"Updating existing user '{existing.username}' to ADMIN role with new credentials...")
            existing.password_hash = hash_password(password)
            existing.role = "ADMIN"
            existing.is_active = True
        else:
            admin_user = User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                role="ADMIN",
                is_active=True
            )
            db.add(admin_user)

        db.commit()
        print(f"Administrator '{username}' successfully provisioned.")
    except Exception as e:
        db.rollback()
        print(f"Error provisioning admin: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_admin()
