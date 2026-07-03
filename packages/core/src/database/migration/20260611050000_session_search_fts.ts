import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260611050000_session_search_fts",
  up(tx) {
    return Effect.gen(function* () {
      const table = yield* tx.get<{ name: string }>(
        `select name from sqlite_master where type = 'table' and name = 'session_title_fts'`,
      )
      if (table) return
      yield* tx.run(`CREATE VIRTUAL TABLE \`session_title_fts\` USING fts5(\`session_id\` UNINDEXED, \`title\`, tokenize = 'unicode61');`)
      yield* tx.run(`INSERT INTO \`session_title_fts\` (\`session_id\`, \`title\`) SELECT \`id\`, \`title\` FROM \`session\`;`)
      yield* tx.run(`CREATE TRIGGER \`session_title_fts_insert\` AFTER INSERT ON \`session\` BEGIN
  INSERT INTO \`session_title_fts\` (\`session_id\`, \`title\`) VALUES (new.\`id\`, new.\`title\`);
END;`)
      yield* tx.run(`CREATE TRIGGER \`session_title_fts_update\` AFTER UPDATE OF \`title\` ON \`session\` BEGIN
  DELETE FROM \`session_title_fts\` WHERE \`session_id\` = old.\`id\`;
  INSERT INTO \`session_title_fts\` (\`session_id\`, \`title\`) VALUES (new.\`id\`, new.\`title\`);
END;`)
      yield* tx.run(`CREATE TRIGGER \`session_title_fts_delete\` AFTER DELETE ON \`session\` BEGIN
  DELETE FROM \`session_title_fts\` WHERE \`session_id\` = old.\`id\`;
END;`)
    })
  },
} satisfies DatabaseMigration.Migration
