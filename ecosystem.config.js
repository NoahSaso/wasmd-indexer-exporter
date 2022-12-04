module.exports = {
  apps: [
    {
      name: 'exporter',
      script: 'dist/export/index.js',
    },
    {
      name: 'server',
      script: 'dist/server/index.js',
      instances: 1,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
}
