//! ROI: the owner's starting numbers next to what FAB Intel measures from its own records.
//! A measured figure with too little data says so. Nothing is estimated.

use crate::auth::User;
use crate::records::{invoices, quotes};
use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Row {
    pub key: String,
    pub label: String,
    pub unit: String,
    pub baseline: Option<f64>,
    pub note: String,
    /// Measured from FAB Intel records. None when FAB Intel cannot measure it, or has too little data.
    pub now: Option<f64>,
    pub how: String,
}

const DAY: i64 = 86_400;

pub fn roi(conn: &Connection, user: &User, today: &str, now: i64) -> Result<Vec<Row>, String> {
    if !user.is_owner() {
        return Err("Only the owner sees ROI.".into());
    }
    let qs = quotes(conn, user)?;
    let real = |s: bool| !s;
    let sent_30 = qs.iter().filter(|q| real(q.sample) && q.sent_at.map(|t| now - t <= 30 * DAY).unwrap_or(false)).count();
    let decided: Vec<_> = qs.iter().filter(|q| real(q.sample) && (q.status == "won" || q.status == "lost") && now - q.created_at <= 90 * DAY).collect();
    let won = decided.iter().filter(|q| q.status == "won").count();
    let turnaround: Vec<f64> = qs
        .iter()
        .filter(|q| real(q.sample))
        .filter_map(|q| match (q.requested_at, q.sent_at) {
            (Some(a), Some(b)) if b >= a && now - b <= 90 * DAY => Some((b - a) as f64 / DAY as f64),
            _ => None,
        })
        .collect();
    let unpaid: i64 = invoices(conn, user, today)?.iter().filter(|i| !i.sample && i.status == "sent").map(|i| i.amount_cents).sum();
    let any_invoice = invoices(conn, user, today)?.iter().any(|i| !i.sample);

    let measured = |key: &str| -> (Option<f64>, String) {
        match key {
            "quotes_month" => (if qs.iter().any(|q| real(q.sample)) { Some(sent_30 as f64) } else { None }, "Quotes marked sent in the last 30 days.".into()),
            "win_rate" => {
                if decided.len() >= 5 {
                    (Some((won as f64 * 1000.0 / decided.len() as f64).round() / 10.0), format!("Won out of {} decided quotes, last 90 days.", decided.len()))
                } else {
                    (None, "Needs 5 won or lost quotes.".into())
                }
            }
            "days_to_quote" => {
                if turnaround.len() >= 3 {
                    let avg = turnaround.iter().sum::<f64>() / turnaround.len() as f64;
                    (Some((avg * 10.0).round() / 10.0), format!("Average over {} quotes with a request date.", turnaround.len()))
                } else {
                    (None, "Needs 3 quotes with a request date.".into())
                }
            }
            "unpaid" => (if any_invoice { Some(unpaid as f64 / 100.0) } else { None }, "Sent invoices not yet paid.".into()),
            _ => (None, "Measured by a 30-day time log after go-live.".into()),
        }
    };

    let mut stmt = conn.prepare("SELECT key, label, unit, value, note FROM roi_baseline ORDER BY rowid").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, Option<f64>>(3)?, r.get::<_, String>(4)?)))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (key, label, unit, baseline, note) = row.map_err(|e| e.to_string())?;
        let (now_value, how) = measured(&key);
        out.push(Row { key, label, unit, baseline, note, now: now_value, how });
    }
    Ok(out)
}

pub fn set_baseline(conn: &Connection, user: &User, key: &str, value: Option<f64>, note: &str) -> Result<(), String> {
    if !user.is_owner() {
        return Err("Only the owner sets starting numbers.".into());
    }
    if let Some(v) = value {
        if !v.is_finite() || v < 0.0 {
            return Err("Enter zero or more.".into());
        }
    }
    let changed = conn
        .execute("UPDATE roi_baseline SET value = ?2, note = ?3 WHERE key = ?1", params![key, value, note])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Unknown starting number.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::records::tests::people;

    #[test]
    fn empty_database_measures_nothing() {
        let (conn, owner, staff) = people();
        let rows = roi(&conn, &owner, "2026-12-01", 1_000_000).unwrap();
        assert!(rows.iter().all(|r| r.now.is_none() && r.baseline.is_none()));
        assert!(roi(&conn, &staff, "2026-12-01", 1).is_err());
    }

    #[test]
    fn owner_sets_baseline() {
        let (conn, owner, _) = people();
        set_baseline(&conn, &owner, "hours_quotes", Some(5.0), "MJ, Nov 20 call").unwrap();
        assert!(set_baseline(&conn, &owner, "nope", Some(1.0), "").is_err());
        assert!(set_baseline(&conn, &owner, "hours_quotes", Some(-1.0), "").is_err());
        let rows = roi(&conn, &owner, "2026-12-01", 1).unwrap();
        assert_eq!(rows[0].baseline, Some(5.0));
    }
}
