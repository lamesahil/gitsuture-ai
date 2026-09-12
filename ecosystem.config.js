module.exports = {
  apps: [
    {
      name: 'gitsuture',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      merge_logs: true,
      time: true,
    }
  ]
};
