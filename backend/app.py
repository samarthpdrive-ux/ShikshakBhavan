import hashlib
import secrets
import time
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, create_engine, func
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

from .config import ADMIN_PASSWORD, CREDENTIAL_ENCRYPTION_KEY, DATABASE_URL

static_dir = Path(__file__).resolve().parent.parent
ca_path = Path(__file__).with_name('ca.pem')
if not ca_path.is_file():
    raise RuntimeError('Missing backend/ca.pem. Download the TiDB CA certificate and place it there before deploying.')
connect_args = {'ssl_ca': str(ca_path), 'ssl_verify_cert': True, 'ssl_verify_identity': True}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base = declarative_base()
cipher = Fernet(CREDENTIAL_ENCRYPTION_KEY.encode())

class CloudinaryAccount(Base):
    __tablename__ = 'cloudinary_accounts'
    id = Column(String(36), primary_key=True)
    name = Column(String(120), nullable=False)
    cloud_name = Column(String(120), nullable=False, unique=True)
    api_key_encrypted = Column(Text, nullable=False)
    api_secret_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    videos = relationship('Video', back_populates='account')

class Video(Base):
    __tablename__ = 'videos'
    id = Column(String(36), primary_key=True)
    title = Column(String(200), nullable=False)
    category = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)
    secure_url = Column(Text, nullable=False)
    public_id = Column(Text, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    is_published = Column(Boolean, nullable=False, default=True)
    account_id = Column(String(36), ForeignKey('cloudinary_accounts.id'), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    account = relationship('CloudinaryAccount', back_populates='videos')

class AccountInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    cloud_name: str = Field(min_length=1, max_length=120)
    api_key: str = Field(min_length=1)
    api_secret: str = Field(min_length=1)

class SignInput(BaseModel):
    account_id: str

class VideoInput(BaseModel):
    account_id: str
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(default='', max_length=120)
    description: str = Field(default='')
    secure_url: str = Field(min_length=1)
    public_id: str = Field(default='')

class OrderInput(BaseModel):
    ids: list[str]

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def admin_auth(x_admin_password: str = Header(default='')):
    if not secrets.compare_digest(x_admin_password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail='Incorrect admin password.')

def account_view(account): return {'id': account.id, 'name': account.name, 'cloudName': account.cloud_name}
def video_view(video): return {'id': video.id, 'title': video.title, 'category': video.category or '', 'description': video.description or '', 'url': video.secure_url, 'publicId': video.public_id or '', 'position': video.position}

app = FastAPI(title='Shrimaan Shikshak Bhavan')

@app.on_event('startup')
def create_tables(): Base.metadata.create_all(engine)

@app.get('/api/videos')
def public_videos(db: Session = Depends(get_db)):
    return [video_view(video) for video in db.query(Video).filter(Video.is_published.is_(True)).order_by(Video.position, Video.created_at).limit(4).all()]

@app.post('/api/admin/verify')
def verify_admin(_: None = Depends(admin_auth)): return {'ok': True}

@app.get('/api/admin/accounts')
def accounts(_: None = Depends(admin_auth), db: Session = Depends(get_db)):
    return [account_view(account) for account in db.query(CloudinaryAccount).order_by(CloudinaryAccount.created_at).all()]

@app.post('/api/admin/accounts', status_code=201)
def create_account(payload: AccountInput, _: None = Depends(admin_auth), db: Session = Depends(get_db)):
    if db.query(CloudinaryAccount).filter_by(cloud_name=payload.cloud_name).first(): raise HTTPException(409, 'This Cloudinary cloud name already exists.')
    account = CloudinaryAccount(id=secrets.token_hex(16), name=payload.name, cloud_name=payload.cloud_name, api_key_encrypted=cipher.encrypt(payload.api_key.encode()).decode(), api_secret_encrypted=cipher.encrypt(payload.api_secret.encode()).decode())
    db.add(account); db.commit(); return account_view(account)

@app.delete('/api/admin/accounts/{account_id}')
def delete_account(account_id: str, _: None = Depends(admin_auth), db: Session = Depends(get_db)):
    account = db.get(CloudinaryAccount, account_id)
    if not account: raise HTTPException(404, 'Account not found.')
    if account.videos: raise HTTPException(409, 'Remove this account’s videos before deleting it.')
    db.delete(account); db.commit(); return {'ok': True}

@app.post('/api/admin/sign')
def sign_upload(payload: SignInput, _: None = Depends(admin_auth), db: Session = Depends(get_db)):
    account = db.get(CloudinaryAccount, payload.account_id)
    if not account: raise HTTPException(404, 'Cloudinary account not found.')
    timestamp, folder = int(time.time()), 'shrimaan-shikshak-bhavan'
    api_key = cipher.decrypt(account.api_key_encrypted.encode()).decode()
    api_secret = cipher.decrypt(account.api_secret_encrypted.encode()).decode()
    signature = hashlib.sha1(f'folder={folder}&timestamp={timestamp}{api_secret}'.encode()).hexdigest()
    return {'cloudName': account.cloud_name, 'apiKey': api_key, 'timestamp': timestamp, 'folder': folder, 'signature': signature}

@app.get('/api/admin/videos')
def admin_videos(_: None = Depends(admin_auth), db: Session = Depends(get_db)):
    return [video_view(video) for video in db.query(Video).order_by(Video.position, Video.created_at).all()]

@app.post('/api/admin/videos', status_code=201)
def create_video(payload: VideoInput, _: None = Depends(admin_auth), db: Session = Depends(get_db)):
    if not db.get(CloudinaryAccount, payload.account_id): raise HTTPException(404, 'Cloudinary account not found.')
    if db.query(Video).filter_by(is_published=True).count() >= 4: raise HTTPException(409, 'Only four published videos are supported.')
    video = Video(id=secrets.token_hex(16), account_id=payload.account_id, title=payload.title, category=payload.category, description=payload.description, secure_url=payload.secure_url, public_id=payload.public_id, position=db.query(Video).count())
    db.add(video); db.commit(); return video_view(video)

@app.delete('/api/admin/videos/{video_id}')
def delete_video(video_id: str, _: None = Depends(admin_auth), db: Session = Depends(get_db)):
    video = db.get(Video, video_id)
    if not video: raise HTTPException(404, 'Video not found.')
    db.delete(video); db.commit(); return {'ok': True}

@app.put('/api/admin/videos/order')
def reorder_videos(payload: OrderInput, _: None = Depends(admin_auth), db: Session = Depends(get_db)):
    videos = {video.id: video for video in db.query(Video).all()}
    if set(payload.ids) != set(videos): raise HTTPException(400, 'Video order does not match current videos.')
    for position, video_id in enumerate(payload.ids): videos[video_id].position = position
    db.commit(); return {'ok': True}

@app.get('/')
def home(): return FileResponse(static_dir / 'index.html')

@app.get('/admin.html')
def admin(): return FileResponse(static_dir / 'admin.html')

app.mount('/', StaticFiles(directory=static_dir, html=True), name='static')
