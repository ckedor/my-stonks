import fs from 'node:fs'
import type { Plugin } from 'vite'

/* Um arquivo do app que uma ferramenta grava: o dev server recebe a mudança
   num POST e reescreve o arquivo com `apply`, que recusa o que não reconhece.
   Só esse arquivo, e só desse jeito. O commit continua sendo o que publica. */
export function sourceFileWriter<Change>(
  name: string,
  endpoint: string,
  file: string,
  apply: (text: string, change: Change) => string,
): Plugin {
  return {
    name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(endpoint, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const change = JSON.parse(body) as Change
            fs.writeFileSync(file, apply(fs.readFileSync(file, 'utf8'), change))
            res.statusCode = 204
            res.end()
          } catch (error) {
            res.statusCode = 400
            res.end(error instanceof Error ? error.message : String(error))
          }
        })
      })
    },
  }
}
