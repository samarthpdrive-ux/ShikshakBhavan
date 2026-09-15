# Hosting Shrimaan Shikshak Bhavan on Vercel

This version is ready to deploy on Vercel with TiDB Cloud and Cloudinary.

## Before deployment

1. Create your TiDB Cloud database and copy its SQLAlchemy/MySQL connection details.
2. Generate an encryption key on your computer:

   `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

3. Push this `srimaan-shikshak-bhavan` folder to a private GitHub repository.

## Deploy on Vercel

1. In Vercel, select **Add New → Project**, then import the GitHub repository.
2. Keep the project root as this `srimaan-shikshak-bhavan` folder. Vercel detects the Python function in `api/index.py`.
3. Add these environment variables in Vercel Project Settings → Environment Variables:

   - `DATABASE_URL` — your TiDB SQLAlchemy URL, for example `mysql+pymysql://USER:URL_ENCODED_PASSWORD@HOST:4000/DATABASE`
   - `MYSQL_SSL_CA` — TiDB CA certificate path if your cluster requires it. For production, use a Vercel-supported certificate strategy or include the CA file securely in the deployment.
   - `ADMIN_PASSWORD` — a new strong production password
   - `CREDENTIAL_ENCRYPTION_KEY` — the generated Fernet key
4. Deploy. Open `/admin.html` on your Vercel website to add Cloudinary credentials and upload videos.

## Important

- Cloudinary API keys and secrets are encrypted before being stored in TiDB.
- Your browser never receives the API secret.
- Videos upload directly to Cloudinary through a server-created signature; TiDB stores their Cloudinary links and order.
- Do not deploy the old `server.js` local helper; Vercel runs `api/index.py`, which exposes the FastAPI application from `backend/app.py`.
