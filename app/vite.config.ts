import path from "path"
import { pathToFileURL } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

type BtcDataHandler = (request: Request) => Promise<Response> | Response

function toFetchHeaders(headers: typeof import('node:http').IncomingMessage.prototype.headers) {
  const fetchHeaders = new Headers()

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => fetchHeaders.append(key, entry))
      return
    }

    if (value !== undefined) {
      fetchHeaders.set(key, value)
    }
  })

  return fetchHeaders
}

function btcDataApiDevPlugin(): Plugin {
  return {
    name: 'btc-data-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/btc-data')) {
          next()
          return
        }

        try {
          const apiPath = path.resolve(__dirname, 'api/btc-data.js')
          const apiModule = await import(pathToFileURL(apiPath).href) as { default: BtcDataHandler }
          const host = req.headers.host ?? '127.0.0.1:5173'
          const request = new Request(`http://${host}${req.url}`, {
            method: req.method,
            headers: toFetchHeaders(req.headers),
          })
          const response = await apiModule.default(request)

          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(`[btc-data-api-dev] ${error instanceof Error ? error.stack : String(error)}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Local btc-data proxy failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    ...(mode === 'development' ? [inspectAttr()] : []),
    btcDataApiDevPlugin(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }

          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-vendor';
          }
        },
      },
    },
  },
}));
