import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { AssistantMessageRow } from "@/lib/contracts";

let insertStmt: Statement | null = null;
let listByConversationStmt: Statement | null = null;

function getInsertStmt(): Statement {
  if (!insertStmt) {
    insertStmt = getDb().prepare(
      `INSERT INTO assistant_messages
        (id, conversation_id, role, content, created_at)
       VALUES
        (@id, @conversation_id, @role, @content, @created_at)`,
    );
  }
  return insertStmt;
}

function getListByConversationStmt(): Statement {
  if (!listByConversationStmt) {
    listByConversationStmt = getDb().prepare(
      `SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    );
  }
  return listByConversationStmt;
}

export function insertAssistantMessage(row: AssistantMessageRow): void {
  getInsertStmt().run(row);
}

export function listMessagesForConversation(
  conversationId: string,
): AssistantMessageRow[] {
  return getListByConversationStmt().all(conversationId) as AssistantMessageRow[];
}
