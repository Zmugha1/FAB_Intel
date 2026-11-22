//! Sample data for demos. Every business and person here is fictional, taken from the FAB Intel demo.
//! Every row is marked sample = 1, the screen shows a Sample data banner, and one click removes it all.

use crate::auth::User;
use crate::quote::{Line, CHECKLIST};
use crate::records::{
    invoice_action, quote_action, save_contact, save_invoice, save_project, save_quote, Contact, Invoice, Project, QuoteInput,
};
use rusqlite::{params, Connection};

const TABLES: [&str; 5] = ["quote_lines", "projects", "invoices", "quotes", "contacts"];

pub fn has_sample(conn: &Connection) -> bool {
    conn.query_row("SELECT COUNT(*) FROM contacts WHERE sample = 1", [], |r| r.get::<_, i64>(0)).map(|n| n > 0).unwrap_or(false)
}

fn mark(conn: &Connection, table: &str, id: i64) -> Result<(), String> {
    conn.execute(&format!("UPDATE {table} SET sample = 1 WHERE id = ?1"), params![id]).map(|_| ()).map_err(|e| e.to_string())
}

fn checked() -> serde_json::Value {
    CHECKLIST.iter().map(|(k, _)| (k.to_string(), serde_json::Value::Bool(true))).collect::<serde_json::Map<_, _>>().into()
}

fn line(item: &str, vendor: &str, deco: &str, qty: i64, cost: i64, price: i64) -> Line {
    Line { item: item.into(), vendor: vendor.into(), decoration: deco.into(), qty, unit_cost_cents: cost, unit_price_cents: price, taxable: true }
}

pub fn load(conn: &Connection, owner: &User, now: i64, today: &str) -> Result<(), String> {
    if !owner.is_owner() {
        return Err("Only the owner loads sample data.".into());
    }
    if has_sample(conn) {
        return Err("Sample data is already loaded.".into());
    }
    let day = 86_400;
    let people = [
        ("Dana Ruiz", "Lakeview Tap Room", "FB"),
        ("Sam Kowalski", "Copper Kettle Pizza", "FB"),
        ("Jordan Lee", "Northpoint Distilling", "FB"),
        ("Chris Novak", "Riverbend Youth Hockey", "FB"),
        ("Alex Brandt", "Harborside Supper Club", "FB"),
        ("Taylor Moss", "Summit Lending Group", "WH"),
        ("Robin Hale", "Bowl & Barrel Lanes", "WM"),
        ("Casey Fox", "Elm Street Bakehouse", "FB,WH"),
    ];
    let mut ids = Vec::new();
    for (i, (name, company, biz)) in people.iter().enumerate() {
        let id = save_contact(
            conn,
            owner,
            &Contact {
                name: (*name).into(),
                company: (*company).into(),
                email: format!("contact{}@example.com", i + 1),
                phone: format!("262-555-01{:02}", i + 10),
                businesses: biz.split(',').map(str::to_owned).collect(),
                source: "Sample".into(),
                ..Default::default()
            },
            now,
        )?;
        mark(conn, "contacts", id)?;
        ids.push(id);
    }

    let quote = |contact: i64, lines: Vec<Line>, checklist: serde_json::Value, requested: i64| QuoteInput {
        id: 0,
        contact_id: contact,
        business: "FB".into(),
        lines,
        checklist,
        notes: String::new(),
        requested_at: Some(requested),
    };
    // Sent four days ago, waiting on the customer.
    let q1 = save_quote(conn, owner, &quote(ids[0], vec![line("Logo pint glass", "Midwest Drinkware Supply", "Etch", 144, 410, 900)], checked(), now - 6 * day), now - 5 * day)?;
    quote_action(conn, owner, q1, "submit", now - 5 * day)?;
    quote_action(conn, owner, q1, "mark_sent", now - 4 * day)?;
    conn.execute("UPDATE quotes SET sent_at = ?2 WHERE id = ?1", params![q1, now - 4 * day]).map_err(|e| e.to_string())?;
    // Under the margin floor, waiting for the owner.
    let q2 = save_quote(conn, owner, &quote(ids[1], vec![line("Oven mitt", "Badger Cushion Co.", "Screen print", 200, 620, 850)], checked(), now - day), now - day)?;
    conn.execute("UPDATE quotes SET status = 'waiting_approval' WHERE id = ?1", params![q2]).map_err(|e| e.to_string())?;
    // Over the approval limit.
    let q3 = save_quote(conn, owner, &quote(ids[2], vec![line("Quarter-zip pullover", "Lakeshore Apparel", "Embroidery", 120, 1900, 3300)], checked(), now - 2 * day), now - day)?;
    conn.execute("UPDATE quotes SET status = 'waiting_approval' WHERE id = ?1", params![q3]).map_err(|e| e.to_string())?;
    // Won, with an invoice and a project.
    let q4 = save_quote(conn, owner, &quote(ids[3], vec![line("Team hat", "Great Lakes Patch Works", "Patch", 60, 1100, 2200)], checked(), now - 20 * day), now - 19 * day)?;
    quote_action(conn, owner, q4, "submit", now - 19 * day)?;
    quote_action(conn, owner, q4, "mark_sent", now - 18 * day)?;
    quote_action(conn, owner, q4, "won", now - 15 * day)?;
    // A draft with the checklist still open.
    let q5 = save_quote(conn, owner, &quote(ids[4], vec![line("Koozie", "Midwest Drinkware Supply", "Full color", 500, 90, 175)], serde_json::json!({"shipping": true}), now), now)?;
    for q in [q1, q2, q3, q4, q5] {
        mark(conn, "quotes", q)?;
    }

    let due = |days_ago: i64| -> String { shift(today, -days_ago) };
    let inv = |contact: i64, biz: &str, cents: i64, repeat: &str, due_date: String| Invoice {
        id: 0,
        number: String::new(),
        contact_id: contact,
        contact: String::new(),
        quote_id: None,
        business: biz.into(),
        amount_cents: cents,
        status: "draft".into(),
        repeat: repeat.into(),
        due_date,
        pay_via: "Stripe".into(),
        notes: String::new(),
        overdue_days: 0,
        sample: false,
    };
    let i1 = save_invoice(conn, owner, &inv(ids[5], "WH", 9900, "monthly", due(6)), now)?;
    invoice_action(conn, owner, i1, "mark_sent", now)?;
    let i2 = save_invoice(conn, owner, &inv(ids[3], "FB", 132_000, "none", due(-10)), now)?;
    invoice_action(conn, owner, i2, "mark_sent", now)?;
    let i3 = save_invoice(conn, owner, &inv(ids[6], "WM", 24_000, "annual", due(30)), now)?;
    invoice_action(conn, owner, i3, "mark_sent", now)?;
    invoice_action(conn, owner, i3, "mark_paid", now)?;
    for i in [i1, i2, i3] {
        mark(conn, "invoices", i)?;
    }

    let proj = |contact: i64, name: &str, proof: &str, in_hands: String, art_ok: bool| Project {
        id: 0,
        name: name.into(),
        contact_id: contact,
        contact: String::new(),
        quote_id: None,
        business: "FB".into(),
        art_link: String::new(),
        art_ok,
        proof: proof.into(),
        revisions: 0,
        in_hands,
        status: "open".into(),
        notes: String::new(),
        sample: false,
    };
    let p1 = save_project(conn, owner, &Project { quote_id: Some(q4), ..proj(ids[3], "Team hats", "sent", due(-5), true) }, now)?;
    let p2 = save_project(conn, owner, &proj(ids[7], "Bakery aprons", "revise", due(-14), false), now)?;
    let p3 = save_project(conn, owner, &proj(ids[0], "Tap room coasters", "none", due(-21), false), now)?;
    for p in [p1, p2, p3] {
        mark(conn, "projects", p)?;
    }
    Ok(())
}

pub fn clear(conn: &Connection, owner: &User) -> Result<(), String> {
    if !owner.is_owner() {
        return Err("Only the owner removes sample data.".into());
    }
    conn.execute("DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE sample = 1)", []).map_err(|e| e.to_string())?;
    for t in TABLES.iter().skip(1) {
        conn.execute(&format!("DELETE FROM {t} WHERE sample = 1"), []).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// A YYYY-MM-DD date moved by `days`.
pub fn shift(date: &str, days: i64) -> String {
    let base = crate::records::days_between("1970-01-01", date).unwrap_or(0) + days;
    // Civil from days (Howard Hinnant's algorithm).
    let z = base + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::brief::brief;
    use crate::records::tests::people;
    use crate::records::{contacts, quotes};

    #[test]
    fn shift_dates() {
        assert_eq!(shift("2026-12-01", -1), "2026-11-30");
        assert_eq!(shift("2024-02-28", 1), "2024-02-29");
        assert_eq!(shift("2026-12-31", 1), "2027-01-01");
    }

    #[test]
    fn load_then_clear_leaves_real_data() {
        let (conn, owner, staff) = people();
        let real = crate::records::tests::a_contact(&conn, &owner, "FB");
        load(&conn, &owner, 10_000_000, "2026-12-03").unwrap();
        assert!(has_sample(&conn));
        assert!(load(&conn, &owner, 10_000_000, "2026-12-03").is_err());
        assert!(load(&conn, &staff, 10_000_000, "2026-12-03").is_err());
        assert_eq!(quotes(&conn, &owner).unwrap().len(), 5);
        let items = brief(&conn, &owner, "2026-12-03", 10_000_000).unwrap();
        assert!(items.iter().any(|i| i.title.starts_with("Approve quote")));
        assert!(items.iter().any(|i| i.title.contains("overdue 6 days")));
        clear(&conn, &owner).unwrap();
        assert!(!has_sample(&conn));
        let left = contacts(&conn, &owner).unwrap();
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].id, real);
    }
}
