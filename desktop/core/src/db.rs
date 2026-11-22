//! The FAB Intel database: one SQLite file on the owner's computer.
//! Every table is created here. Changes to an applied schema go in a new numbered step.

use rusqlite::{params, Connection};

/// Schema steps, applied in order. Never edit an applied step; add a new one.
const STEPS: [&str; 1] = [r#"
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','staff')),
  businesses TEXT NOT NULL DEFAULT 'FB,WH,WM',
  password_hash TEXT,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT,
  last_seen INTEGER NOT NULL DEFAULT 0
);
INSERT INTO session (id, user_id, last_seen) VALUES (1, NULL, 0);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  businesses TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sample INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE quotes (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  business TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','waiting_approval','approved','sent','won','lost')),
  checklist TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  requested_at INTEGER,
  sent_at INTEGER,
  decided_at INTEGER,
  sample INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE quote_lines (
  id INTEGER PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  vendor TEXT NOT NULL DEFAULT '',
  decoration TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  taxable INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  quote_id INTEGER REFERENCES quotes(id),
  business TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','sent','paid','void')),
  repeat TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','monthly','annual')),
  due_date TEXT NOT NULL,
  paid_at INTEGER,
  pay_via TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sample INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  quote_id INTEGER REFERENCES quotes(id),
  business TEXT NOT NULL,
  art_link TEXT NOT NULL DEFAULT '',
  art_ok INTEGER NOT NULL DEFAULT 0,
  proof TEXT NOT NULL DEFAULT 'none' CHECK (proof IN ('none','sent','revise','approved')),
  revisions INTEGER NOT NULL DEFAULT 0,
  in_hands TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','delivered','closed')),
  notes TEXT NOT NULL DEFAULT '',
  sample INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE decision_log (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE TABLE roi_baseline (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value REAL,
  unit TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
INSERT INTO roi_baseline (key, label, value, unit) VALUES
  ('hours_quotes', 'Hours a week on quotes', NULL, 'hours/week'),
  ('hours_invoices', 'Hours a week on invoices and chasing payments', NULL, 'hours/week'),
  ('hours_art', 'Hours a week on artwork back and forth', NULL, 'hours/week'),
  ('hours_content', 'Hours a week on newsletters and posts', NULL, 'hours/week'),
  ('quotes_month', 'Quotes sent per month', NULL, 'quotes'),
  ('win_rate', 'Quotes won', NULL, 'percent'),
  ('days_to_quote', 'Days from request to quote sent', NULL, 'days'),
  ('unpaid', 'Unpaid invoice total', NULL, 'dollars'),
  ('software', 'Monthly software FAB Intel replaces', NULL, 'dollars/month');
"#];

pub fn open(path: &str) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    prepare(&conn)?;
    Ok(conn)
}

pub fn open_memory() -> Result<Connection, String> {
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    prepare(&conn)?;
    Ok(conn)
}

fn prepare(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|e| e.to_string())?;
    conn.execute_batch("CREATE TABLE IF NOT EXISTS schema_steps (step INTEGER PRIMARY KEY);")
        .map_err(|e| e.to_string())?;
    for (index, sql) in STEPS.iter().enumerate() {
        let step = index as i64 + 1;
        let done: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_steps WHERE step = ?1", params![step], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if done == 0 {
            conn.execute_batch(&format!("BEGIN; {sql} INSERT INTO schema_steps (step) VALUES ({step}); COMMIT;"))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn log(conn: &Connection, now: i64, user: &str, action: &str, entity: &str, id: Option<i64>, detail: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO decision_log (at, user_id, action, entity, entity_id, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![now, user, action, entity, id, detail],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_twice_without_reapplying_steps() {
        let dir = std::env::temp_dir().join(format!("fab-db-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("fab.db");
        let path = path.to_str().unwrap();
        open(path).unwrap();
        let conn = open(path).unwrap();
        let steps: i64 = conn.query_row("SELECT COUNT(*) FROM schema_steps", [], |r| r.get(0)).unwrap();
        assert_eq!(steps, 1);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn baseline_starts_empty() {
        let conn = open_memory().unwrap();
        let filled: i64 = conn.query_row("SELECT COUNT(*) FROM roi_baseline WHERE value IS NOT NULL", [], |r| r.get(0)).unwrap();
        assert_eq!(filled, 0, "no baseline number is invented");
    }
}
