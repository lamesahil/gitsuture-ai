module.exports = {
  apps: [
    {
      name: 'gitsuture',
      script: 'dist/index.js',
      cwd: '/opt/gitsuture',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/gitsuture/out.log',
      error_file: '/var/log/gitsuture/error.log',
      merge_logs: true,
      time: true,
    }
  ]
};
