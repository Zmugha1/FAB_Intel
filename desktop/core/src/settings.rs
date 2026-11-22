//! Owner settings. Defaults come from the signed agreement (Schedule A starting rules)
//! and the STZ interview. A setting with no default stays empty until the owner sets it.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Rules {
    /// Margin floor in basis points. 3500 = 35%. Agreement starting rule; STZ: 35% is the sponsor price.
    pub margin_floor_bp: i64,
    /// Quotes over this total need the owner. Agreement starting rule: $2,500.
    pub approve_over_cents: i64,
    /// STZ: the owner approves every quote staff drafts.
    pub staff_quotes_need_owner: bool,
    /// Sales tax in basis points. None until the owner sets it.
    pub tax_rate_bp: Option<i64>,
    pub quote_valid_days: i64,
    pub follow_up_days: i64,
    /// Can staff see vendor costs and margins? None until the owner answers.
    /// Unanswered behaves as yes, because the STZ interview says staff price from vendor costs.
    pub staff_see_costs: Option<bool>,
}

impl Rules {
    pub fn staff_costs_visible(&self) -> bool {
        self.staff_see_costs.unwrap_or(true)
    }
}

pub const YES_NO: [&str; 2] = ["staff_quotes_need_owner", "staff_see_costs"];

pub const KEYS: [&str; 7] = [
    "margin_floor_bp",
    "approve_over_cents",
    "staff_quotes_need_owner",
    "tax_rate_bp",
    "quote_valid_days",
    "follow_up_days",
    "staff_see_costs",
];

fn get(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| r.get(0))
        .optional()
        .ok()
        .flatten()
}

fn num(conn: &Connection, key: &str) -> Option<i64> {
    get(conn, key).and_then(|v| v.parse().ok())
}

pub fn rules(conn: &Connection) -> Rules {
    Rules {
        margin_floor_bp: num(conn, "margin_floor_bp").unwrap_or(3500),
        approve_over_cents: num(conn, "approve_over_cents").unwrap_or(250_000),
        staff_quotes_need_owner: get(conn, "staff_quotes_need_owner").map(|v| v != "0").unwrap_or(true),
        tax_rate_bp: num(conn, "tax_rate_bp"),
        quote_valid_days: num(conn, "quote_valid_days").unwrap_or(14),
        follow_up_days: num(conn, "follow_up_days").unwrap_or(3),
        staff_see_costs: get(conn, "staff_see_costs").map(|v| v != "0"),
    }
}

pub fn set(conn: &Connection, owner: bool, key: &str, value: &str) -> Result<(), String> {
    if !owner {
        return Err("Only the owner can change rules.".into());
    }
    if !KEYS.contains(&key) {
        return Err("Unknown setting.".into());
    }
    if YES_NO.contains(&key) {
        if value != "0" && value != "1" {
            return Err("Use 1 for yes or 0 for no.".into());
        }
    } else {
        let n: i64 = value.trim().parse().map_err(|_| "Enter a whole number.".to_string())?;
        if n < 0 {
            return Err("Enter zero or more.".into());
        }
        if (key == "margin_floor_bp" || key == "tax_rate_bp") && n > 10_000 {
            return Err("A percentage cannot be over 100.".into());
        }
    }
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value.trim()],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_memory;

    #[test]
    fn defaults_follow_the_agreement_and_tax_stays_empty() {
        let conn = open_memory().unwrap();
        let r = rules(&conn);
        assert_eq!(r.margin_floor_bp, 3500);
        assert_eq!(r.approve_over_cents, 250_000);
        assert!(r.staff_quotes_need_owner);
        assert_eq!(r.tax_rate_bp, None);
        assert_eq!(r.staff_see_costs, None);
        assert!(r.staff_costs_visible());
    }

    #[test]
    fn owner_answers_the_cost_question() {
        let conn = open_memory().unwrap();
        assert!(set(&conn, true, "staff_see_costs", "maybe").is_err());
        set(&conn, true, "staff_see_costs", "0").unwrap();
        assert_eq!(rules(&conn).staff_see_costs, Some(false));
        assert!(!rules(&conn).staff_costs_visible());
        set(&conn, true, "tax_rate_bp", "0").unwrap();
        assert_eq!(rules(&conn).tax_rate_bp, Some(0));
    }

    #[test]
    fn staff_cannot_change_rules() {
        let conn = open_memory().unwrap();
        assert!(set(&conn, false, "margin_floor_bp", "3000").is_err());
        assert!(set(&conn, true, "margin_floor_bp", "20000").is_err());
        set(&conn, true, "tax_rate_bp", "550").unwrap();
        assert_eq!(rules(&conn).tax_rate_bp, Some(550));
    }
}
