import yargs, { type Argv, type CommandModule } from "yargs"
import { hideBin } from "yargs/helpers"
import * as Log from "@opencode-ai/core/util/log"
import { UI } from "./cli/ui"
import { Installation } from "./installation"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { NamedError } from "@opencode-ai/core/util/error"
import { FormatError } from "./cli/error"
import { Filesystem } from "@/util/filesystem"
import { EOL } from "os"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { JsonMigration } from "@/storage/json-migration"
import { Database } from "@/storage/db"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { ensureProcessMetadata } from "@opencode-ai/core/util/opencode-process"
import { isRecord } from "@/util/record"

const processMetadata = ensureProcessMetadata("main")

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: errorMessage(e),
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: errorMessage(e),
  })
})

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("opencode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text)
    return
  }
  process.stderr.write(out)
}

function lazyCommand(
  input: Pick<CommandModule<object, object>, "command" | "describe" | "aliases">,
  load: () => Promise<unknown>,
) {
  let command: Promise<CommandModule<object, object>> | undefined

  async function resolve() {
    command ??= load().then((result) => result as CommandModule<object, object>)
    return command
  }

  return {
    ...input,
    async builder(yargs: Argv<object>) {
      const loaded = await resolve()
      if (!loaded.builder) return yargs
      if (typeof loaded.builder === "function") return loaded.builder(yargs)
      return yargs.options(loaded.builder)
    },
    async handler(args) {
      const loaded = await resolve()
      return loaded.handler(args)
    },
  } satisfies CommandModule<object, object>
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("opencode")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    await Log.init({
      print: process.argv.includes("--print-logs"),
      dev: Installation.isLocal(),
      level: (() => {
        if (opts.logLevel) return opts.logLevel as Log.Level
        if (Installation.isLocal()) return "DEBUG"
        return "INFO"
      })(),
    })

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)

    Log.Default.info("opencode", {
      version: InstallationVersion,
      args: process.argv.slice(2),
      process_role: processMetadata.processRole,
      run_id: processMetadata.runID,
    })

    const marker = path.join(Global.Path.data, "opencode.db")
    if (!(await Filesystem.exists(marker))) {
      const tty = process.stderr.isTTY
      process.stderr.write("Performing one time database migration, may take a few minutes..." + EOL)
      const width = 36
      const orange = "\x1b[38;5;214m"
      const muted = "\x1b[0;2m"
      const reset = "\x1b[0m"
      let last = -1
      if (tty) process.stderr.write("\x1b[?25l")
      try {
        await JsonMigration.run(drizzle({ client: Database.Client().$client }), {
          progress: (event) => {
            const percent = Math.floor((event.current / event.total) * 100)
            if (percent === last && event.current !== event.total) return
            last = percent
            if (tty) {
              const fill = Math.round((percent / 100) * width)
              const bar = `${"■".repeat(fill)}${"･".repeat(width - fill)}`
              process.stderr.write(
                `\r${orange}${bar} ${percent.toString().padStart(3)}%${reset} ${muted}${event.label.padEnd(12)} ${event.current}/${event.total}${reset}`,
              )
              if (event.current === event.total) process.stderr.write("\n")
            } else {
              process.stderr.write(`sqlite-migration:${percent}${EOL}`)
            }
          },
        })
      } finally {
        if (tty) process.stderr.write("\x1b[?25h")
        else {
          process.stderr.write(`sqlite-migration:done${EOL}`)
        }
      }
      process.stderr.write("Database migration complete." + EOL)
    }
  })
  .usage("")
  .completion("completion", "generate shell completion script")
  .command(
    lazyCommand({ command: "acp", describe: "start ACP (Agent Client Protocol) server" }, () =>
      import("./cli/cmd/acp").then((module) => module.AcpCommand),
    ),
  )
  .command(
    lazyCommand({ command: "mcp", describe: "manage MCP (Model Context Protocol) servers" }, () =>
      import("./cli/cmd/mcp").then((module) => module.McpCommand),
    ),
  )
  .command(
    lazyCommand({ command: "$0 [project]", describe: "start opencode tui" }, () =>
      import("./cli/cmd/tui/thread").then((module) => module.TuiThreadCommand),
    ),
  )
  .command(
    lazyCommand({ command: "attach <url>", describe: "attach to opencode server" }, () =>
      import("./cli/cmd/tui/attach").then((module) => module.AttachCommand),
    ),
  )
  .command(
    lazyCommand({ command: "run [message..]", describe: "run opencode with a message" }, () =>
      import("./cli/cmd/run").then((module) => module.RunCommand),
    ),
  )
  .command(
    lazyCommand({ command: "generate", describe: undefined }, () =>
      import("./cli/cmd/generate").then((module) => module.GenerateCommand),
    ),
  )
  .command(
    lazyCommand({ command: "debug", describe: "debugging and troubleshooting tools" }, () =>
      import("./cli/cmd/debug/index").then((module) => module.DebugCommand),
    ),
  )
  .command(
    lazyCommand({ command: "console", describe: false }, () =>
      import("./cli/cmd/account").then((module) => module.ConsoleCommand),
    ),
  )
  .command(
    lazyCommand(
      { command: "providers", aliases: ["auth"], describe: "manage AI providers and credentials" },
      () => import("./cli/cmd/providers").then((module) => module.ProvidersCommand),
    ),
  )
  .command(
    lazyCommand({ command: "agent", describe: "manage agents" }, () =>
      import("./cli/cmd/agent").then((module) => module.AgentCommand),
    ),
  )
  .command(
    lazyCommand({ command: "upgrade [target]", describe: "upgrade opencode to the latest or a specific version" }, () =>
      import("./cli/cmd/upgrade").then((module) => module.UpgradeCommand),
    ),
  )
  .command(
    lazyCommand({ command: "uninstall", describe: "uninstall opencode and remove all related files" }, () =>
      import("./cli/cmd/uninstall").then((module) => module.UninstallCommand),
    ),
  )
  .command(
    lazyCommand({ command: "serve", describe: "starts a headless opencode server" }, () =>
      import("./cli/cmd/serve").then((module) => module.ServeCommand),
    ),
  )
  .command(
    lazyCommand({ command: "web", describe: "start opencode server and open web interface" }, () =>
      import("./cli/cmd/web").then((module) => module.WebCommand),
    ),
  )
  .command(
    lazyCommand({ command: "models [provider]", describe: "list all available models" }, () =>
      import("./cli/cmd/models").then((module) => module.ModelsCommand),
    ),
  )
  .command(
    lazyCommand({ command: "stats", describe: "show token usage and cost statistics" }, () =>
      import("./cli/cmd/stats").then((module) => module.StatsCommand),
    ),
  )
  .command(
    lazyCommand({ command: "export [sessionID]", describe: "export session data as JSON" }, () =>
      import("./cli/cmd/export").then((module) => module.ExportCommand),
    ),
  )
  .command(
    lazyCommand({ command: "import <file>", describe: "import session data from JSON file or URL" }, () =>
      import("./cli/cmd/import").then((module) => module.ImportCommand),
    ),
  )
  .command(
    lazyCommand({ command: "github", describe: "manage GitHub agent" }, () =>
      import("./cli/cmd/github").then((module) => module.GithubCommand),
    ),
  )
  .command(
    lazyCommand({ command: "pr <number>", describe: "fetch and checkout a GitHub PR branch, then run opencode" }, () =>
      import("./cli/cmd/pr").then((module) => module.PrCommand),
    ),
  )
  .command(
    lazyCommand({ command: "session", describe: "manage sessions" }, () =>
      import("./cli/cmd/session").then((module) => module.SessionCommand),
    ),
  )
  .command(
    lazyCommand({ command: "plugin <module>", aliases: ["plug"], describe: "install plugin and update config" }, () =>
      import("./cli/cmd/plug").then((module) => module.PluginCommand),
    ),
  )
  .command(
    lazyCommand({ command: "db", describe: "database tools" }, () =>
      import("./cli/cmd/db").then((module) => module.DbCommand),
    ),
  )
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    let printed = false
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      printed = true
      show(out)
    })
    if (!printed && args.every((arg) => arg.startsWith("-"))) {
      show(await cli.getHelp())
    }
  } else {
    await cli.parse()
  }
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
      stack: e.stack,
    })
  }

  if (e instanceof NamedError) {
    const obj = e.toObject()
    if (isRecord(obj.data)) {
      for (const [key, value] of Object.entries(obj.data)) {
        if (key === "name" || key === "stack" || key === "cause") continue
        data[key] = value
      }
    }
  }

  if (e instanceof ResolveMessage) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      code: e.code,
      specifier: e.specifier,
      referrer: e.referrer,
      position: e.position,
      importKind: e.importKind,
    })
  }
  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error, check log file at " + Log.file() + " for more details" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
