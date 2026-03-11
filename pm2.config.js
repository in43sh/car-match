module.exports = {
  apps: [
    {
      name: 'web',
      script: './node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'worker',
      script: './node_modules/.bin/tsx',
      args: 'src/worker.ts',
      env: {
        NODE_ENV: 'production',
      },
      // Restart on crash, but not more than 5 times in 30s (avoids restart loop on bad session)
      max_restarts: 10,
      min_uptime:   '30s',
    },
  ],
}
