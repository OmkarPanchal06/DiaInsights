// Preflight for `npm run test:e2e`.
//
// Playwright is configured with reuseExistingServer: false so the tests always start
// their own backend with RATE_LIMIT_PER_MINUTE raised for test traffic. If a dev
// server is already listening, Playwright would either fail with a generic port error
// or -- worse -- the tests could run against the everyday backend with the 60/min
// default. Fail early with something actionable instead.
//
// Run: node scripts/check-e2e-ports.mjs
import { connect } from "node:net"

const PORTS = [
  { port: 8000, label: "backend (uvicorn)", hint: "Stop it: Get-NetTCPConnection -LocalPort 8000 | Stop-Process" },
  { port: 3000, label: "frontend (next dev)", hint: "Stop it: Get-NetTCPConnection -LocalPort 3000 | Stop-Process" },
]

function probe(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" })
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(700)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })
}

const busy = []
for (const { port } of PORTS) {
  if (await probe(port)) busy.push({ port, label })
}

if (busy.length > 0) {
  console.error(
    "\nCannot start the e2e suite: a server is already listening.\n",
  )
  for (const { port, label } of busy) {
    console.error(`  port ${port} is in use by ${label}`)
  }
  console.error(
    "\nThe tests must start their own backend so the raised RATE_LIMIT_PER_MINUTE applies.\nStop your dev servers first, in PowerShell:\n",
  )
  for (const { port, hint } of PORTS) {
    if (busy.some((b) => b.port === port)) console.error(`  ${hint}`)
  }
  console.error("")
  process.exit(1)
}

console.log("Ports 8000 and 3000 are free.")