module.exports = {
  apps: [
    {
      name: 'mikro-assistant',
      script: './src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Environment variables are loaded from .env file via dotenv
      // You can override them here if needed, or set them in .env
      env: {
        NODE_ENV: 'production'
        // PORT and other vars will be loaded from .env file
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
