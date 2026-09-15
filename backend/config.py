import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))

DATABASE_URL = os.getenv('DATABASE_URL', '')
MYSQL_SSL_CA = os.getenv('MYSQL_SSL_CA', '')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')
CREDENTIAL_ENCRYPTION_KEY = os.getenv('CREDENTIAL_ENCRYPTION_KEY', '')

if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL must be set. Use the TiDB MySQL SQLAlchemy URL.')
if not ADMIN_PASSWORD:
    raise RuntimeError('ADMIN_PASSWORD must be set.')
if not CREDENTIAL_ENCRYPTION_KEY:
    raise RuntimeError('CREDENTIAL_ENCRYPTION_KEY must be set. Generate it with Fernet.generate_key().')
