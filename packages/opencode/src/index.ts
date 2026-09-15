import yargs, { type Argv, type CommandModule } from "yargs"
import { hideBin } from "yargs/helpers"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { EOL } from "os"
import { Global } from "@opencode-ai/core/global"
import { Database } from "@opencode-ai/core/database/database"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"
import { AttachCommand } from "./cli/cmd/attach"
import { TuiThreadCommand } from "./cli/cmd/tui"

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("opencode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
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
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
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
  .command(TuiThreadCommand)
  .command(AttachCommand)
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
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
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
