import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"

const cli = path.join(process.cwd(), "dist", "npm-cli.js")

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  })
}

test("help renders retained commands", () => {
  const result = run(["--help"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /run \[message\.\.[^\n]*retained npm-portable CLI flow/)
  assert.match(result.stdout, /db path/)
})

test("run supports json output", () => {
  const result = run(["run", "hello", "world", "--format", "json"])
  assert.equal(result.status, 0)
  assert.deepEqual(JSON.parse(result.stdout), {
    command: "run",
    cwd: process.cwd(),
    input: "hello world",
  })
})

test("db path respects OPENCODE_DB override", () => {
  const result = run(["db", "path"], {
    env: {
      ...process.env,
      OPENCODE_DATA_DIR: "/tmp/opencode-data",
      OPENCODE_DB: "portable.db",
    },
  })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), "/tmp/opencode-data/portable.db")
})
