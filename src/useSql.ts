/* 
Copied from https://github.com/raycast/extensions/blob/main/extensions/apple-notes/src/useSql.ts
Original credits to @mathieudutour and @raycast
*/

import { environment, getPreferenceValues } from "@raycast/api";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";
import { useRef, useState, useEffect } from "react";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { PermissionError } from "./errors";
import { SMS } from "./types";

let SQL: SqlJsStatic;

const loadDatabase = async (path: string) => {
  if (!SQL) {
    const wasmBinary = await readFile(resolve(environment.assetsPath, "sql-wasm.wasm"));
    SQL = await initSqlJs({ wasmBinary });
  }
  const fileContents = await readFile(path);
  return new SQL.Database(fileContents);
};

const useSql = <Result>(path: string, query: string) => {
  const databaseRef = useRef<Database>();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [results, setResults] = useState<Result[]>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    (async () => {
      if (!databaseRef.current) {
try {
  databaseRef.current = await loadDatabase(path);
} catch (e) {
  if (e instanceof Error && e.message.includes("operation not permitted")) {
setError(new PermissionError("You do not have permission to access the database."));
  } else {
setError(e as Error);
  }
  return;
}
      }

      try {
const newResults = new Array<Result>();
const statement = databaseRef.current.prepare(query);
while (statement.step()) {
  newResults.push(statement.getAsObject() as unknown as Result);
}

setResults(newResults);

statement.free();
      } catch (e) {
console.error(e);
if (error instanceof Error && error.message.includes("operation not permitted")) {
  setError(new PermissionError("You do not have permission to access the database."));
} else {
  setError(e as Error);
}
      } finally {
setIsLoading(false);
      }
    })();
  }, [path, query]);

  useEffect(() => {
    return () => {
      databaseRef.current?.close();
    };
  }, []);

  return { results, error, isLoading };
};

const SMS_DB = resolve(homedir() + "/Library/Messages/chat.db");
const periodToLookInSms = getPreferenceValues().periodToLookInSms as number | 15;

const smsesQuery = `
select
message.rowid,
message.date_read,
message.is_read, 
ifnull(handle.uncanonicalized_id, chat.chat_identifier) AS sender,
message.service,
datetime(message.date / 1000000000 + 978307200, 'unixepoch', 'localtime') AS message_date,
message.text
from
message
    left join chat_message_join
            on chat_message_join.message_id = message.ROWID
    left join chat
            on chat.ROWID = chat_message_join.chat_id
    left join handle
            on message.handle_id = handle.ROWID
where
message.is_from_me = 0
and message.text is not null
and length(message.text) > 0
and (
    message.text glob '*[0-9][0-9][0-9]*'
    or message.text glob '*[0-9][0-9][0-9][0-9]*'
    or message.text glob '*[0-9][0-9][0-9][0-9][0-9]*'
    or message.text glob '*[0-9][0-9][0-9][0-9][0-9][0-9]*'
    or message.text glob '*[0-9][0-9][0-9]-[0-9][0-9][0-9]*'
    or message.text glob '*[0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'
    or message.text glob '*[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'
)
and datetime(message.date / 1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime')
>= datetime('now', '-${periodToLookInSms} minutes', 'localtime')
order by
message.date desc
limit 100
`;

export const useSqlSMS = () => useSql<SMS>(SMS_DB, smsesQuery);
