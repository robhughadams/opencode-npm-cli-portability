#!/usr/bin/env node

import os from "node:os"
import path from "node:path"
import { text } from "node:stream/consumers"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

function resolveDataDirectory() {
  if (process.env.OPENCODE_DATA_DIR) return path.resolve(process.env.OPENCODE_DATA_DIR)
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "opencode")
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "opencode")
  }
  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "opencode")
}

function resolveDatabasePath() {
  if (process.env.OPENCODE_DB) {
    if (process.env.OPENCODE_DB === ":memory:" || path.isAbsolute(process.env.OPENCODE_DB)) return process.env.OPENCODE_DB
    return path.join(resolveDataDirectory(), process.env.OPENCODE_DB)
  }
  return path.join(resolveDataDirectory(), "opencode.db")
}

await yargs(hideBin(process.argv))
  .scriptName("opencode")
  .usage("$0 <command>")
  .help()
  .alias("help", "h")
  .version("version", "show version number", "1.15.5")
  .alias("version", "v")
  .command(
    "run [message..]",
    "run the retained npm-portable CLI flow",
    {
      format: {
        type: "string",
        choices: ["default", "json"] as const,
        default: "default",
        describe: "output format",
      },
    },
    async (args) => {
      const piped = process.stdin.isTTY ? "" : await text(process.stdin)
      const input = [...(Array.isArray(args.message) ? args.message : []), ...(Array.isArray(args["--"]) ? args["--"] : [])]
        .join(" ")
        .trim()
      const merged = [input, piped.trim()].filter(Boolean).join("\n")

      if (!merged) {
        process.stderr.write("Error: You must provide a message or pipe input.\n")
        process.exitCode = 1
        return
      }

      if (args.format === "json") {
        process.stdout.write(
          JSON.stringify(
            {
              command: "run",
              cwd: process.cwd(),
              input: merged,
            },
            null,
            2,
          ) + "\n",
        )
        return
      }

      process.stdout.write(`opencode npm-cli portability fork\n${merged}\n`)
    },
  )
  .command("db path", "print the retained CLI database path", () => {}, () => {
    process.stdout.write(resolveDatabasePath() + "\n")
  })
  .strict()
  .demandCommand(1)
  .parseAsync()
