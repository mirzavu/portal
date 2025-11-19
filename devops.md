# DevOps Documentation - Production Server Changes

## Production Server: portal.demotesting.co.uk
**Server IP:** 139.59.66.225  
**SSH User:** dev  
**Server Type:** HestiaCP (Ubuntu)

---

## Date: 2025-11-19

### Nginx Configuration Changes

#### 1. Created Proxy Templates
**Location:** `/usr/local/hestia/data/templates/web/nginx/`

**Files Created:**
- `portal_3005.stpl` (SSL/HTTPS template)
- `portal_3005.tpl` (HTTP template)

**Purpose:** Proxy all requests to Next.js app running on port 3005

**Configuration:**
- Proxies all requests (including static files) to `http://127.0.0.1:3005`
- Blocks PHP requests and WordPress paths
- Sets proper proxy headers (X-Real-IP, X-Forwarded-For, etc.)
- Handles WebSocket upgrades

**Applied via:** HestiaCP Admin UI -> Web -> portal.demotesting.co.uk -> Proxy Template: `portal_3005`

#### 2. Removed Conflicting Nginx Config Files
**Date:** 2025-11-19

**Files Deleted:**
- `/etc/nginx/conf.d/domains/portal.demotesting.co.uk.conf` (symlink)
- `/etc/nginx/conf.d/domains/portal.demotesting.co.uk.ssl.conf` (symlink)

**Reason:** These were default HestiaCP-generated configs that conflicted with the proxy template. HestiaCP should manage configs via templates, not direct files.

**Command Used:**
```bash
sudo rm -f /etc/nginx/conf.d/domains/portal.demotesting.co.uk.conf
sudo rm -f /etc/nginx/conf.d/domains/portal.demotesting.co.uk.ssl.conf
sudo systemctl reload nginx
```

---

## Application Deployment

### PM2 Configuration
**Location:** `/home/dev/web/portal.demotesting.co.uk/public_html/ecosystem.config.js`

**Apps Managed:**
1. **portal-web** (Next.js)
   - Port: 3005
   - Command: `npm start`
   - Environment: `NODE_ENV=production`

2. **portal-pb** (PocketBase)
   - Port: 8095 (localhost only)
   - Command: `./pocketbase serve --http=127.0.0.1:8095`

**Startup:**
```bash
cd /home/dev/web/portal.demotesting.co.uk/public_html
pm2 start ecosystem.config.js
pm2 save
```

### Build Process
**Important:** Must install ALL dependencies (including devDependencies) for Tailwind CSS to compile correctly.

**Correct Build Process:**
```bash
cd /home/dev/web/portal.demotesting.co.uk/public_html
npm install  # NOT npm install --production
npm run build
pm2 restart portal-web
```

**Note:** Using `npm install --production` skips Tailwind CSS and PostCSS, causing CSS compilation to fail.

### Database Migrations
**Location:** `/home/dev/web/portal.demotesting.co.uk/public_html/pb_migrations/`

**Run Migrations:**
```bash
cd /home/dev/web/portal.demotesting.co.uk/public_html
./pocketbase migrate up
```

**Migrations Applied:**
- `1731700000_create_security_gps_collections.js` - Creates door_knocks, bike_locations, user_locations, alerts collections

---

## Deployment Path
**Production Directory:** `/home/dev/web/portal.demotesting.co.uk/public_html/`

**Files Deployed:**
- `.next/` (Next.js build output)
- `app/` (Next.js app directory)
- `components/` (React components)
- `lib/` (Utility libraries)
- `public/` (Static assets)
- `package.json`, `package-lock.json`
- `pb_migrations/` (PocketBase migrations)
- `pocketbase` (PocketBase binary)
- `ecosystem.config.js` (PM2 config)

---

## GitHub Actions Deployment

**Workflow:** `.github/workflows/deploy.yml`

**Process:**
1. Builds Next.js app on GitHub Actions runner
2. Syncs files via rsync to production server
3. Installs dependencies and runs migrations
4. Restarts PM2 processes

**Note:** Currently requires manual intervention for first-time setup. Future deployments should be fully automated.

---

## Troubleshooting

### Styles Not Loading
**Issue:** CSS/Tailwind styles not applying in production

**Root Cause:** 
- Missing devDependencies during build (Tailwind CSS, PostCSS)
- Conflicting Nginx configs serving static files incorrectly

**Solution:**
1. Ensure `npm install` (not `--production`) is run before build
2. Remove conflicting Nginx configs in `/etc/nginx/conf.d/domains/`
3. Ensure HestiaCP proxy template is applied correctly

### 502 Bad Gateway
**Issue:** Nginx returns 502 error

**Check:**
```bash
pm2 list  # Verify portal-web is running
curl http://127.0.0.1:3005  # Test if app responds locally
```

**Fix:**
```bash
cd /home/dev/web/portal.demotesting.co.uk/public_html
pm2 restart portal-web
```

---

## Service Management

### PM2 Commands
```bash
pm2 list                    # List all processes
pm2 logs portal-web         # View logs
pm2 restart portal-web      # Restart Next.js app
pm2 restart portal-pb       # Restart PocketBase
pm2 reload ecosystem.config.js  # Reload config
pm2 save                    # Save current process list
```

### Nginx Commands
```bash
sudo nginx -t              # Test configuration
sudo systemctl reload nginx  # Reload without downtime
sudo systemctl restart nginx # Full restart
```

---

## Environment Variables

**Note:** Environment variables should be set on the production server, not committed to git.

**Location:** `/home/dev/web/portal.demotesting.co.uk/public_html/.env.local` or `.env.production`

**Variables:**
- `NEXT_PUBLIC_POCKETBASE_URL` - PocketBase URL (defaults to http://localhost:8095)
- `NEXT_PUBLIC_PIN_CODE` - PIN code for authentication (defaults to 1234)

---

## Security Notes

- PocketBase runs on localhost only (127.0.0.1:8095) - not exposed publicly
- Next.js API routes act as proxy to PocketBase for security
- PHP requests are blocked via Nginx
- Hidden files (except `.well-known`) are blocked

---

## Fresh Deployment - 2025-11-19

### Clean Deployment Process
**Date:** 2025-11-19

**Steps Taken:**
1. Stopped PM2 processes (`portal-web`, `portal-pb`)
2. Cleaned production directory (removed all app files)
3. Fresh rsync deployment of all source files and build artifacts
4. Installed ALL dependencies (including devDependencies for Tailwind CSS)
5. Built Next.js app on production server
6. Ran PocketBase migrations
7. Started PM2 processes

**Key Changes:**
- Updated `.github/workflows/deploy.yml` to:
  - Include all source directories (`app/`, `components/`, `lib/`, etc.)
  - Install ALL dependencies (not just production) for Tailwind CSS compilation
  - Build on server after deployment
  - Handle env file copying (placeholder for future implementation)

**Deployment Command:**
```bash
cd /home/dev/web/portal.demotesting.co.uk/public_html
npm install  # ALL dependencies including devDeps
npm run build
./pocketbase migrate up
pm2 start ecosystem.config.js
pm2 save
```

**Note:** The deployment workflow now builds on the server to ensure Tailwind CSS compiles correctly with all dependencies available.

**Important:** After deployment, ensure HestiaCP proxy template is set:
1. Go to HestiaCP Admin -> Web -> portal.demotesting.co.uk -> Edit
2. Set **Proxy Template** to `portal_3005`
3. Save/Apply changes
4. Remove any default `index.html` file from `public_html/` directory

The app runs on port 3005 and is accessible locally, but Nginx must proxy requests to it via the template.

---

## Last Updated
2025-11-19

