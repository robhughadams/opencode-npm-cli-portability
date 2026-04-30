import { describe, expect, test } from "bun:test"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { InstallationChannel } from "@opencode-ai/core/installation/version"
import { Database } from "@/storage/db"
import { sql } from "drizzle-orm"

describe("Database.Path", () => {
  test("returns database path for the current channel", () => {
    const expected = ["latest", "beta"].includes(InstallationChannel)
      ? path.join(Global.Path.data, "opencode.db")
      : path.join(Global.Path.data, `opencode-${InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
    expect(Database.getChannelPath()).toBe(expected)
  })

  test("migration creates session title fts table", () => {
    const row = Database.use((db) =>
      db
        .get(sql`select name from sqlite_master where type = 'table' and name = 'session_title_fts'`) as
        | { name: string }
        | undefined,
    )

    expect(row?.name).toBe("session_title_fts")
  })
})
