# Office Task Management System — Deployment Guide
## Hostinger VPS (Node.js + PostgreSQL + nginx)

---

## What's Inside This Package

```
office-tasks-production/
├── server/
│   ├── dist/           ← compiled Node.js backend (self-contained, no npm install needed)
│   ├── public/         ← built React frontend (served by Node)
│   └── uploads/        ← file upload storage (created automatically on first run)
├── database/
│   └── schema.sql      ← PostgreSQL schema (run once to create all tables)
├── nginx/
│   └── office-tasks.conf  ← nginx reverse proxy config
├── ecosystem.config.cjs   ← PM2 process manager config
├── .env.example           ← environment variable template
└── DEPLOY.md              ← this file
```

---

## Prerequisites

Log into your VPS via SSH and install the following (if not already installed):

### 1. Node.js 20+
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should show v20.x or higher
```

### 2. PostgreSQL
```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. nginx
```bash
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4. PM2 (process manager)
```bash
sudo npm install -g pm2
```

---

## Step 1 — Upload Files to Your VPS

On your local machine, upload the package to your VPS using SCP or an SFTP client (e.g. FileZilla):

```bash
# Using SCP (replace user and your-vps-ip)
scp -r office-tasks-production/ user@your-vps-ip:/tmp/
```

Then on the VPS, move it to the web directory:
```bash
sudo mkdir -p /var/www/office-tasks
sudo cp -r /tmp/office-tasks-production/server    /var/www/office-tasks/
sudo cp    /tmp/office-tasks-production/ecosystem.config.cjs /var/www/office-tasks/
sudo mkdir -p /var/www/office-tasks/server/uploads
sudo mkdir -p /var/log/pm2
```

---

## Step 2 — Set Up the PostgreSQL Database

```bash
# Switch to the postgres user
sudo -i -u postgres

# Create a database user (choose a strong password)
psql -c "CREATE USER office_user WITH PASSWORD 'your_strong_password';"

# Create the database
psql -c "CREATE DATABASE office_tasks OWNER office_user;"

# Grant privileges
psql -c "GRANT ALL PRIVILEGES ON DATABASE office_tasks TO office_user;"

# Exit postgres user
exit
```

### Load the database schema
```bash
psql -U office_user -d office_tasks -h localhost -f /tmp/office-tasks-production/database/schema.sql
```

You will be prompted for the password you set above.

---

## Step 3 — Configure Environment Variables

```bash
# Copy the example file
cp /tmp/office-tasks-production/.env.example /var/www/office-tasks/server/.env

# Edit it with your actual values
nano /var/www/office-tasks/server/.env
```

Fill in these values:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://office_user:your_strong_password@localhost:5432/office_tasks
JWT_SECRET=paste_a_long_random_string_here
```

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copy the output and paste it as your `JWT_SECRET`.

---

## Step 4 — Start the Application with PM2

```bash
cd /var/www/office-tasks

# Start the app
pm2 start ecosystem.config.cjs

# Check it's running
pm2 status

# View live logs
pm2 logs office-tasks

# Make PM2 restart on server reboot
pm2 startup
# (run the command it prints out)
pm2 save
```

At this point the app is running on **port 3000**. Test it:
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}
```

---

## Step 5 — Configure nginx

```bash
# Copy the nginx config
sudo cp /tmp/office-tasks-production/nginx/office-tasks.conf \
        /etc/nginx/sites-available/office-tasks.conf

# Edit it to set your domain name
sudo nano /etc/nginx/sites-available/office-tasks.conf
# Change: server_name yourdomain.com www.yourdomain.com;
# To:     server_name tasks.yourcompany.com www.tasks.yourcompany.com;

# Enable the site
sudo ln -s /etc/nginx/sites-available/office-tasks.conf \
           /etc/nginx/sites-enabled/office-tasks.conf

# Remove the default nginx site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test the config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

Your app is now accessible on **port 80** at your domain.

---

## Step 6 — Enable HTTPS (Free SSL with Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get a certificate (replace with your actual domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot will automatically update your nginx config for HTTPS
# and set up auto-renewal
```

---

## Step 7 — Point Your Domain to the VPS

In your domain registrar (or Hostinger DNS settings), add:

| Type | Name | Value              |
|------|------|--------------------|
| A    | @    | YOUR_VPS_IP        |
| A    | www  | YOUR_VPS_IP        |

DNS changes can take up to 24 hours to propagate.

---

## First Login

Once the app is live, log in with the default admin account:

- **Email:** `admin@office.com`
- **Password:** `admin123`

**Important:** Change this password immediately after your first login via the profile settings page.

You can also add these additional sample user accounts if you want test data:
- `user@office.com` / `user123`
- `alice@office.com` / `user123`
- `bob@office.com` / `user123`

---

## File Uploads

Uploaded files are stored in `/var/www/office-tasks/server/uploads/`.

To make them persist across deployments and keep your disk tidy, you may want to point this to a dedicated volume or regularly back it up:
```bash
# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz /var/www/office-tasks/server/uploads/
```

---

## Useful Commands

```bash
# Restart the app
pm2 restart office-tasks

# Stop the app
pm2 stop office-tasks

# View logs
pm2 logs office-tasks --lines 100

# Monitor CPU/memory
pm2 monit

# Reload nginx after config changes
sudo systemctl reload nginx

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## Updating the App

When you have a new version of the built files:

```bash
# Upload new server/dist and server/public folders
# Then restart the app
pm2 restart office-tasks
```

---

## Troubleshooting

**App won't start:**
```bash
pm2 logs office-tasks   # check for error messages
# Common causes:
# - DATABASE_URL is wrong (test with: psql "$DATABASE_URL")
# - JWT_SECRET not set
# - Port 3000 already in use: lsof -i :3000
```

**502 Bad Gateway from nginx:**
```bash
pm2 status   # make sure the app is running
curl http://localhost:3000/api/health   # test the app directly
```

**Database connection refused:**
```bash
sudo systemctl status postgresql   # check postgres is running
psql -U office_user -d office_tasks -h localhost   # test connection
```
