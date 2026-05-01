# Deployment Guide — Hostinger VPS

This guide covers deploying the Office Task Management System on a Hostinger VPS running Ubuntu/Debian.

## Prerequisites

- VPS with Ubuntu 22.04 LTS (or similar)
- Root or sudo access
- Domain name (optional but recommended)

---

## 1. Server Setup

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install nginx (reverse proxy)
sudo apt install -y nginx

# Install pm2 (process manager)
npm install -g pm2
```

---

## 2. PostgreSQL Setup

```bash
# Switch to postgres user and create DB + user
sudo -u postgres psql <<EOF
CREATE USER office_user WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';
CREATE DATABASE office_tasks OWNER office_user;
GRANT ALL PRIVILEGES ON DATABASE office_tasks TO office_user;
EOF
```

---

## 3. Deploy the Application

```bash
# Clone or copy the project to the server
git clone https://your-repo-url.git /srv/office-tasks
cd /srv/office-tasks

# Install dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm run build
```

---

## 4. Environment Variables

Create `/srv/office-tasks/.env` (never commit this file):

```env
# Required — generate with: openssl rand -hex 32
JWT_SECRET=<your-64-character-random-secret>

# PostgreSQL connection URL
DATABASE_URL=postgresql://office_user:CHANGE_THIS_STRONG_PASSWORD@localhost:5432/office_tasks

# API server port (nginx will proxy to this)
PORT=8080

# Node environment
NODE_ENV=production
```

> **Important:** `JWT_SECRET` must be set or the API server will refuse to start in production.

---

## 5. Database Migration & Seed

```bash
cd /srv/office-tasks

# Run Drizzle migrations
pnpm --filter @workspace/db run migrate

# (Optional) Seed initial data — admin@office.com / admin123, user@office.com / user123
pnpm --filter @workspace/scripts run seed
```

> Change the admin password immediately after first login via the Users page.

---

## 6. Build Frontend

```bash
cd /srv/office-tasks

# Build the React frontend (outputs to artifacts/office-tasks/dist)
pnpm --filter @workspace/office-tasks run build
```

---

## 7. Start Services with PM2

Create `/srv/office-tasks/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "office-api",
      cwd: "/srv/office-tasks/artifacts/api-server",
      script: "pnpm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
      env_file: "/srv/office-tasks/.env",
    },
  ],
};
```

```bash
pm2 start /srv/office-tasks/ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

---

## 8. Nginx Configuration

Create `/etc/nginx/sites-available/office-tasks`:

```nginx
server {
    listen 80;
    server_name your-domain.com;   # or your VPS IP

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend static files
    location / {
        root /srv/office-tasks/artifacts/office-tasks/dist;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/office-tasks /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. HTTPS with Let's Encrypt (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Certbot will automatically configure HTTPS and renewal
```

---

## 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Default Credentials

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Admin | admin@office.com    | admin123  |
| User  | user@office.com     | user123   |
| User  | alice@office.com    | user123   |
| User  | bob@office.com      | user123   |

> **Change all passwords immediately after first login.**

---

## Updating the Application

```bash
cd /srv/office-tasks
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/office-tasks run build
pm2 restart office-api
```
