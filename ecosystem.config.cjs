module.exports = {
  apps: [
    {
      name: "office-tasks",
      // Node 20+ natively loads .env from the server/ folder
      script: "node",
      args: "--enable-source-maps --env-file=.env ./dist/index.mjs",
      cwd: "/var/www/office-tasks/server",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "/var/log/pm2/office-tasks-error.log",
      out_file: "/var/log/pm2/office-tasks-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
