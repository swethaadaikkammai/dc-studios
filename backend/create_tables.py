import sys
sys.path.insert(0, 'C:/Users/srira/.gemini/antigravity/scratch/vit-dance-studio-booking/backend')
from app.db.session import engine, Base
from app.models import user, room, team, booking, club_settings, audit_log, board_permission, outbox_event
print('Creating all tables...')
Base.metadata.create_all(bind=engine)
print('Done! Tables:', list(Base.metadata.tables.keys()))
