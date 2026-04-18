import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, 'dist/server')

const { default: server } = await import(resolve(distDir, 'server.js'))

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'

const certPath = resolve(__dirname, 'certs/petasos.taile216db.ts.net.crt')
const keyPath = resolve(__dirname, 'certs/petasos.taile216db.ts.net.key')
const useHttps = existsSync(certPath) && existsSync(keyPath)

function handler(req, res) {
  const url = new URL(req.url, `${useHttps ? 'https' : 'http'}://${req.headers.host || 'localhost'}`)
  
  // Build headers object
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  server.fetch(new Request(url.toString(), {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
    // @ts-ignore
    duplex: 'half',
  })).then(response => {
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    return response.arrayBuffer().then(ab => {
      res.end(Buffer.from(ab))
    })
  }).catch(err => {
    console.error('Server error:', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  })
}

const httpServer = useHttps
  ? createHttpsServer({
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    }, handler)
  : createHttpServer(handler)

httpServer.listen(PORT, HOST, () => {
  const protocol = useHttps ? 'https' : 'http'
  console.log(`Petasos production server running on ${protocol}://${HOST}:${PORT}`)
  console.log(`Tailscale: https://petasos.taile216db.ts.net:${PORT}`)
})
