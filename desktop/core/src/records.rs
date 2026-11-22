//! Contacts, quotes, invoices and projects. Every write records who did it in the decision log.
//! Staff see only the businesses on their user record. The owner sees all three.

use crate::auth::User;
use crate::db::log;
use crate::quote::{self, Line, Totals};
use crate::settings::rules;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const BUSINESSES: [(&str, &str); 3] = [("FB", "F&B Merch"), ("WH", "WurkHub"), ("WM", "WiscoMary")];

fn check_business(user: &User, business: &str) -> Result<(), String> {
    if !BUSINESSES.iter().any(|(k, _)| *k == business) {
        return Err("Pick a business.".into());
    }
    if !user.sees(business) {
        return Err("You do not have access to that business.".into());
    }
    Ok(())
}

fn err(e: rusqlite::Error) -> String {
    e.to_string()
}

// ---------- Contacts ----------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Contact {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub company: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub businesses: Vec<String>,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub sample: bool,
}

fn row_contact(r: &rusqlite::Row) -> rusqlite::Result<Contact> {
    let b: String = r.get(5)?;
    Ok(Contact {
        id: r.get(0)?,
        name: r.get(1)?,
        company: r.get(2)?,
        email: r.get(3)?,
        phone: r.get(4)?,
        businesses: b.split(',').filter(|s| !s.is_empty()).map(str::to_owned).collect(),
        source: r.get(6)?,
        notes: r.get(7)?,
        sample: r.get::<_, i64>(8)? == 1,
    })
}

const CONTACT_COLS: &str = "id, name, company, email, phone, businesses, source, notes, sample";

pub fn contacts(conn: &Connection, user: &User) -> Result<Vec<Contact>, String> {
    let mut stmt = conn.prepare(&format!("SELECT {CONTACT_COLS} FROM contacts ORDER BY company, name")).map_err(err)?;
    let all: Vec<Contact> = stmt.query_map([], row_contact).map_err(err)?.collect::<Result<_, _>>().map_err(err)?;
    Ok(all
        .into_iter()
        .filter(|c| user.is_owner() || c.businesses.iter().any(|b| user.sees(b)))
        .collect())
}

fn contact(conn: &Connection, id: i64) -> Result<Option<Contact>, String> {
    conn.query_row(&format!("SELECT {CONTACT_COLS} FROM contacts WHERE id = ?1"), params![id], row_contact)
        .optional()
        .map_err(err)
}

pub fn save_contact(conn: &Connection, user: &User, c: &Contact, now: i64) -> Result<i64, String> {
    if c.name.trim().is_empty() {
        return Err("Enter a name.".into());
    }
    if c.email.trim().is_empty() && c.phone.trim().is_empty() {
        return Err("Enter an email or a phone number.".into());
    }
    if c.businesses.is_empty() {
        return Err("Tag at least one business.".into());
    }
    for b in &c.businesses {
        check_business(user, b)?;
    }
    let tags = c.businesses.join(",");
    if c.id == 0 {
        conn.execute(
            "INSERT INTO contacts (name, company, email, phone, businesses, source, notes, created_by, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            params![c.name.trim(), c.company.trim(), c.email.trim(), c.phone.trim(), tags, c.source.trim(), c.notes, user.id, now],
        )
        .map_err(err)?;
        let id = conn.last_insert_rowid();
        log(conn, now, &user.id, "added", "contact", Some(id), c.name.trim())?;
        Ok(id)
    } else {
        let existing = contact(conn, c.id)?.ok_or("That contact no longer exists.")?;
        if !user.is_owner() && !existing.businesses.iter().any(|b| user.sees(b)) {
            return Err("You do not have access to that contact.".into());
        }
        conn.execute(
            "UPDATE contacts SET name=?2, company=?3, email=?4, phone=?5, businesses=?6, source=?7, notes=?8, updated_at=?9 WHERE id=?1",
            params![c.id, c.name.trim(), c.company.trim(), c.email.trim(), c.phone.trim(), tags, c.source.trim(), c.notes, now],
        )
        .map_err(err)?;
        log(conn, now, &user.id, "edited", "contact", Some(c.id), c.name.trim())?;
        Ok(c.id)
    }
}

/// Possible duplicates: same email, or same phone digits. The owner decides; nothing merges on its own.
pub fn duplicates(conn: &Connection, user: &User) -> Result<Vec<(i64, i64, String)>, String> {
    let list = contacts(conn, user)?;
    let digits = |s: &str| s.chars().filter(char::is_ascii_digit).collect::<String>();
    let mut out = Vec::new();
    for (i, a) in list.iter().enumerate() {
        for b in &list[i + 1..] {
            if !a.email.is_empty() && a.email.eq_ignore_ascii_case(&b.email) {
                out.push((a.id, b.id, "Same email".to_owned()));
            } else if digits(&a.phone).len() >= 10 && digits(&a.phone) == digits(&b.phone) {
                out.push((a.id, b.id, "Same phone".to_owned()));
            }
        }
    }
    Ok(out)
}

// ---------- Quotes ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteInput {
    #[serde(default)]
    pub id: i64,
    pub contact_id: i64,
    pub business: String,
    pub lines: Vec<Line>,
    #[serde(default)]
    pub checklist: serde_json::Value,
    #[serde(default)]
    pub notes: String,
    /// When the customer asked for the quote, unix seconds. Used for days-to-quote on the ROI page.
    #[serde(default)]
    pub requested_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Quote {
    pub id: i64,
    pub number: String,
    pub contact_id: i64,
    pub contact: String,
    pub business: String,
    pub status: String,
    pub lines: Vec<Line>,
    pub checklist: serde_json::Value,
    pub open_checklist: Vec<&'static str>,
    pub notes: String,
    pub totals: Totals,
    pub needs_owner: Vec<String>,
    pub created_by: String,
    pub approved_by: Option<String>,
    pub requested_at: Option<i64>,
    pub sent_at: Option<i64>,
    pub created_at: i64,
    pub sample: bool,
}

fn lines_for(conn: &Connection, quote_id: i64) -> Result<Vec<Line>, String> {
    let mut stmt = conn
        .prepare("SELECT item, vendor, decoration, qty, unit_cost_cents, unit_price_cents, taxable FROM quote_lines WHERE quote_id = ?1 ORDER BY id")
        .map_err(err)?;
    let rows = stmt
        .query_map(params![quote_id], |r| {
            Ok(Line {
                item: r.get(0)?,
                vendor: r.get(1)?,
                decoration: r.get(2)?,
                qty: r.get(3)?,
                unit_cost_cents: r.get(4)?,
                unit_price_cents: r.get(5)?,
                taxable: r.get::<_, i64>(6)? == 1,
            })
        })
        .map_err(err)?;
    rows.collect::<Result<_, _>>().map_err(err)
}

fn is_staff(conn: &Connection, user_id: &str) -> bool {
    conn.query_row("SELECT role FROM users WHERE id = ?1", params![user_id], |r| r.get::<_, String>(0))
        .map(|r| r == "staff")
        .unwrap_or(false)
}

pub fn quote(conn: &Connection, user: &User, id: i64) -> Result<Quote, String> {
    let r = rules(conn);
    let row = conn
        .query_row(
            "SELECT q.id, q.number, q.contact_id, c.name || CASE WHEN c.company <> '' THEN ', ' || c.company ELSE '' END, q.business, q.status, \
             q.checklist, q.notes, q.created_by, q.approved_by, q.requested_at, q.sent_at, q.created_at, q.sample \
             FROM quotes q JOIN contacts c ON c.id = q.contact_id WHERE q.id = ?1",
            params![id],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, String>(7)?,
                    r.get::<_, String>(8)?,
                    r.get::<_, Option<String>>(9)?,
                    r.get::<_, Option<i64>>(10)?,
                    r.get::<_, Option<i64>>(11)?,
                    r.get::<_, i64>(12)?,
                    r.get::<_, i64>(13)?,
                ))
            },
        )
        .optional()
        .map_err(err)?
        .ok_or("That quote no longer exists.")?;
    if !user.sees(&row.4) {
        return Err("You do not have access to that quote.".into());
    }
    let lines = lines_for(conn, id)?;
    let totals = quote::totals(&lines, r.tax_rate_bp);
    let checklist: serde_json::Value = serde_json::from_str(&row.6).unwrap_or_default();
    let needs_owner = quote::approval_reasons(&totals, &r, is_staff(conn, &row.8));
    Ok(Quote {
        id: row.0,
        number: row.1,
        contact_id: row.2,
        contact: row.3,
        business: row.4,
        status: row.5,
        open_checklist: quote::open_checklist(&checklist),
        checklist,
        lines,
        notes: row.7,
        totals,
        needs_owner,
        created_by: row.8,
        approved_by: row.9,
        requested_at: row.10,
        sent_at: row.11,
        created_at: row.12,
        sample: row.13 == 1,
    })
}

pub fn quotes(conn: &Connection, user: &User) -> Result<Vec<Quote>, String> {
    let ids: Vec<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM quotes ORDER BY id DESC").map_err(err)?;
        let rows = stmt.query_map([], |r| r.get(0)).map_err(err)?;
        rows.collect::<Result<_, _>>().map_err(err)?
    };
    let mut out = Vec::new();
    for id in ids {
        if let Ok(q) = quote(conn, user, id) {
            out.push(q);
        }
    }
    Ok(out)
}

fn next_number(conn: &Connection, table: &str, prefix: &str) -> Result<String, String> {
    let n: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0)).map_err(err)?;
    let mut candidate = 1001 + n;
    loop {
        let number = format!("{prefix}-{candidate}");
        let taken: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {table} WHERE number = ?1"), params![number], |r| r.get(0))
            .map_err(err)?;
        if taken == 0 {
            return Ok(number);
        }
        candidate += 1;
    }
}

pub fn save_quote(conn: &Connection, user: &User, q: &QuoteInput, now: i64) -> Result<i64, String> {
    check_business(user, &q.business)?;
    if contact(conn, q.contact_id)?.is_none() {
        return Err("Pick a contact.".into());
    }
    if q.lines.is_empty() {
        return Err("Add at least one line.".into());
    }
    for l in &q.lines {
        if l.item.trim().is_empty() || l.qty <= 0 || l.unit_cost_cents < 0 || l.unit_price_cents < 0 {
            return Err("Each line needs an item, a quantity above zero, and prices of zero or more.".into());
        }
    }
    let checklist = if q.checklist.is_object() { q.checklist.to_string() } else { "{}".to_owned() };
    let id = if q.id == 0 {
        let number = next_number(conn, "quotes", "Q")?;
        conn.execute(
            "INSERT INTO quotes (number, contact_id, business, status, checklist, notes, requested_at, created_by, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 'draft', ?4, ?5, ?6, ?7, ?8, ?8)",
            params![number, q.contact_id, q.business, checklist, q.notes, q.requested_at, user.id, now],
        )
        .map_err(err)?;
        let id = conn.last_insert_rowid();
        log(conn, now, &user.id, "drafted", "quote", Some(id), &number)?;
        id
    } else {
        let existing = quote(conn, user, q.id)?;
        if existing.status != "draft" {
            return Err("Only a draft can be edited. Ask the owner to send it back to draft.".into());
        }
        conn.execute(
            "UPDATE quotes SET contact_id=?2, business=?3, checklist=?4, notes=?5, requested_at=?6, updated_at=?7 WHERE id=?1",
            params![q.id, q.contact_id, q.business, checklist, q.notes, q.requested_at, now],
        )
        .map_err(err)?;
        conn.execute("DELETE FROM quote_lines WHERE quote_id = ?1", params![q.id]).map_err(err)?;
        log(conn, now, &user.id, "edited", "quote", Some(q.id), &existing.number)?;
        q.id
    };
    for l in &q.lines {
        conn.execute(
            "INSERT INTO quote_lines (quote_id, item, vendor, decoration, qty, unit_cost_cents, unit_price_cents, taxable) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, l.item.trim(), l.vendor.trim(), l.decoration.trim(), l.qty, l.unit_cost_cents, l.unit_price_cents, l.taxable as i64],
        )
        .map_err(err)?;
    }
    Ok(id)
}

fn set_status(conn: &Connection, id: i64, status: &str, now: i64) -> Result<(), String> {
    conn.execute("UPDATE quotes SET status = ?2, updated_at = ?3 WHERE id = ?1", params![id, status, now])
        .map(|_| ())
        .map_err(err)
}

/// Moves a quote forward. The safety buttons live here:
/// the checklist must be complete, and anything the rules flag waits for the owner.
pub fn quote_action(conn: &Connection, user: &User, id: i64, action: &str, now: i64) -> Result<String, String> {
    let q = quote(conn, user, id)?;
    let result = match (action, q.status.as_str()) {
        ("submit", "draft") => {
            if !q.open_checklist.is_empty() {
                return Err(format!("Finish the checklist first: {}.", q.open_checklist.join(", ")));
            }
            if q.needs_owner.is_empty() {
                set_status(conn, id, "approved", now)?;
                conn.execute("UPDATE quotes SET approved_by = ?2 WHERE id = ?1", params![id, user.id]).map_err(err)?;
                "approved"
            } else {
                set_status(conn, id, "waiting_approval", now)?;
                "waiting_approval"
            }
        }
        ("approve", "waiting_approval") => {
            if !user.is_owner() {
                return Err("Only the owner approves quotes.".into());
            }
            set_status(conn, id, "approved", now)?;
            conn.execute("UPDATE quotes SET approved_by = ?2 WHERE id = ?1", params![id, user.id]).map_err(err)?;
            "approved"
        }
        ("back_to_draft", "waiting_approval") | ("back_to_draft", "approved") => {
            if !user.is_owner() && q.status == "approved" {
                return Err("Only the owner can reopen an approved quote.".into());
            }
            set_status(conn, id, "draft", now)?;
            conn.execute("UPDATE quotes SET approved_by = NULL WHERE id = ?1", params![id]).map_err(err)?;
            "draft"
        }
        ("mark_sent", "approved") => {
            set_status(conn, id, "sent", now)?;
            conn.execute("UPDATE quotes SET sent_at = ?2 WHERE id = ?1", params![id, now]).map_err(err)?;
            "sent"
        }
        ("won", "sent") | ("lost", "sent") => {
            set_status(conn, id, action, now)?;
            conn.execute("UPDATE quotes SET decided_at = ?2 WHERE id = ?1", params![id, now]).map_err(err)?;
            action
        }
        _ => return Err(format!("A {} quote cannot do that.", q.status.replace('_', " "))),
    };
    let detail = if result == "waiting_approval" { q.needs_owner.join(" ") } else { q.number.clone() };
    log(conn, now, &user.id, &format!("quote {action}"), "quote", Some(id), &detail)?;
    Ok(result.to_owned())
}

// ---------- Invoices ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub number: String,
    pub contact_id: i64,
    #[serde(default)]
    pub contact: String,
    #[serde(default)]
    pub quote_id: Option<i64>,
    pub business: String,
    pub amount_cents: i64,
    #[serde(default = "draft")]
    pub status: String,
    #[serde(default = "none")]
    pub repeat: String,
    pub due_date: String,
    #[serde(default)]
    pub pay_via: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub overdue_days: i64,
    #[serde(default)]
    pub sample: bool,
}

fn draft() -> String {
    "draft".into()
}
fn none() -> String {
    "none".into()
}

/// Days between two YYYY-MM-DD dates (b minus a). None if either is not a date.
pub fn days_between(a: &str, b: &str) -> Option<i64> {
    fn day_number(s: &str) -> Option<i64> {
        let mut parts = s.split('-');
        let y: i64 = parts.next()?.parse().ok()?;
        let m: i64 = parts.next()?.parse().ok()?;
        let d: i64 = parts.next()?.parse().ok()?;
        if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
            return None;
        }
        // Days from civil date (Howard Hinnant's algorithm).
        let y = if m <= 2 { y - 1 } else { y };
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = y - era * 400;
        let mp = (m + 9) % 12;
        let doy = (153 * mp + 2) / 5 + d - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        Some(era * 146_097 + doe)
    }
    Some(day_number(b)? - day_number(a)?)
}

pub fn invoices(conn: &Connection, user: &User, today: &str) -> Result<Vec<Invoice>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.number, i.contact_id, c.name || CASE WHEN c.company <> '' THEN ', ' || c.company ELSE '' END, i.quote_id, i.business, \
             i.amount_cents, i.status, i.repeat, i.due_date, i.pay_via, i.notes, i.sample \
             FROM invoices i JOIN contacts c ON c.id = i.contact_id ORDER BY i.due_date DESC, i.id DESC",
        )
        .map_err(err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Invoice {
                id: r.get(0)?,
                number: r.get(1)?,
                contact_id: r.get(2)?,
                contact: r.get(3)?,
                quote_id: r.get(4)?,
                business: r.get(5)?,
                amount_cents: r.get(6)?,
                status: r.get(7)?,
                repeat: r.get(8)?,
                due_date: r.get(9)?,
                pay_via: r.get(10)?,
                notes: r.get(11)?,
                overdue_days: 0,
                sample: r.get::<_, i64>(12)? == 1,
            })
        })
        .map_err(err)?;
    let mut out = Vec::new();
    for inv in rows {
        let mut inv = inv.map_err(err)?;
        if !user.sees(&inv.business) {
            continue;
        }
        if inv.status == "sent" {
            inv.overdue_days = days_between(&inv.due_date, today).unwrap_or(0).max(0);
        }
        out.push(inv);
    }
    Ok(out)
}

pub fn save_invoice(conn: &Connection, user: &User, inv: &Invoice, now: i64) -> Result<i64, String> {
    check_business(user, &inv.business)?;
    if contact(conn, inv.contact_id)?.is_none() {
        return Err("Pick a contact.".into());
    }
    if inv.amount_cents <= 0 {
        return Err("Enter an amount above zero.".into());
    }
    if days_between(&inv.due_date, &inv.due_date).is_none() {
        return Err("Enter a due date.".into());
    }
    if !["none", "monthly", "annual"].contains(&inv.repeat.as_str()) {
        return Err("Repeat must be none, monthly or annual.".into());
    }
    if inv.id == 0 {
        let number = next_number(conn, "invoices", "INV")?;
        conn.execute(
            "INSERT INTO invoices (number, contact_id, quote_id, business, amount_cents, status, repeat, due_date, pay_via, notes, created_by, created_at, updated_at) \
             VALUES (?1,?2,?3,?4,?5,'draft',?6,?7,?8,?9,?10,?11,?11)",
            params![number, inv.contact_id, inv.quote_id, inv.business, inv.amount_cents, inv.repeat, inv.due_date, inv.pay_via, inv.notes, user.id, now],
        )
        .map_err(err)?;
        let id = conn.last_insert_rowid();
        log(conn, now, &user.id, "created", "invoice", Some(id), &number)?;
        Ok(id)
    } else {
        let status: String = conn.query_row("SELECT status FROM invoices WHERE id = ?1", params![inv.id], |r| r.get(0)).map_err(err)?;
        if status != "draft" {
            return Err("Only a draft invoice can be edited.".into());
        }
        conn.execute(
            "UPDATE invoices SET contact_id=?2, business=?3, amount_cents=?4, repeat=?5, due_date=?6, pay_via=?7, notes=?8, updated_at=?9 WHERE id=?1",
            params![inv.id, inv.contact_id, inv.business, inv.amount_cents, inv.repeat, inv.due_date, inv.pay_via, inv.notes, now],
        )
        .map_err(err)?;
        log(conn, now, &user.id, "edited", "invoice", Some(inv.id), "")?;
        Ok(inv.id)
    }
}

/// An invoice from a won quote, for the quote total. Due in `due_days`.
pub fn invoice_from_quote(conn: &Connection, user: &User, quote_id: i64, due_date: &str, now: i64) -> Result<i64, String> {
    let q = quote(conn, user, quote_id)?;
    if q.status != "won" {
        return Err("Only a won quote becomes an invoice.".into());
    }
    let exists: i64 = conn.query_row("SELECT COUNT(*) FROM invoices WHERE quote_id = ?1", params![quote_id], |r| r.get(0)).map_err(err)?;
    if exists > 0 {
        return Err("This quote already has an invoice.".into());
    }
    let inv = Invoice {
        id: 0,
        number: String::new(),
        contact_id: q.contact_id,
        contact: String::new(),
        quote_id: Some(quote_id),
        business: q.business.clone(),
        amount_cents: q.totals.total_cents,
        status: "draft".into(),
        repeat: "none".into(),
        due_date: due_date.into(),
        pay_via: String::new(),
        notes: format!("From quote {}", q.number),
        overdue_days: 0,
        sample: false,
    };
    save_invoice(conn, user, &inv, now)
}

pub fn invoice_action(conn: &Connection, user: &User, id: i64, action: &str, now: i64) -> Result<(), String> {
    let (status, business): (String, String) = conn
        .query_row("SELECT status, business FROM invoices WHERE id = ?1", params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(err)?;
    if !user.sees(&business) {
        return Err("You do not have access to that invoice.".into());
    }
    let next = match (action, status.as_str()) {
        ("mark_sent", "draft") => "sent",
        ("mark_paid", "sent") => "paid",
        ("void", "draft") | ("void", "sent") => {
            if !user.is_owner() {
                return Err("Only the owner can void an invoice.".into());
            }
            "void"
        }
        _ => return Err(format!("A {status} invoice cannot do that.")),
    };
    conn.execute(
        "UPDATE invoices SET status = ?2, paid_at = CASE WHEN ?2 = 'paid' THEN ?3 ELSE paid_at END, updated_at = ?3 WHERE id = ?1",
        params![id, next, now],
    )
    .map_err(err)?;
    log(conn, now, &user.id, &format!("invoice {action}"), "invoice", Some(id), "")
}

// ---------- Projects and artwork ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub contact_id: i64,
    #[serde(default)]
    pub contact: String,
    #[serde(default)]
    pub quote_id: Option<i64>,
    pub business: String,
    #[serde(default)]
    pub art_link: String,
    /// Art checked and ready to print, as marked by a person.
    #[serde(default)]
    pub art_ok: bool,
    #[serde(default = "proof_none")]
    pub proof: String,
    #[serde(default)]
    pub revisions: i64,
    #[serde(default)]
    pub in_hands: String,
    #[serde(default = "open_status")]
    pub status: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub sample: bool,
}

fn proof_none() -> String {
    "none".into()
}
fn open_status() -> String {
    "open".into()
}

pub fn projects(conn: &Connection, user: &User) -> Result<Vec<Project>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.contact_id, c.name || CASE WHEN c.company <> '' THEN ', ' || c.company ELSE '' END, p.quote_id, p.business, \
             p.art_link, p.art_ok, p.proof, p.revisions, p.in_hands, p.status, p.notes, p.sample \
             FROM projects p JOIN contacts c ON c.id = p.contact_id ORDER BY p.status, p.in_hands, p.id DESC",
        )
        .map_err(err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Project {
                id: r.get(0)?,
                name: r.get(1)?,
                contact_id: r.get(2)?,
                contact: r.get(3)?,
                quote_id: r.get(4)?,
                business: r.get(5)?,
                art_link: r.get(6)?,
                art_ok: r.get::<_, i64>(7)? == 1,
                proof: r.get(8)?,
                revisions: r.get(9)?,
                in_hands: r.get(10)?,
                status: r.get(11)?,
                notes: r.get(12)?,
                sample: r.get::<_, i64>(13)? == 1,
            })
        })
        .map_err(err)?;
    let all: Vec<Project> = rows.collect::<Result<_, _>>().map_err(err)?;
    Ok(all.into_iter().filter(|p| user.sees(&p.business)).collect())
}

pub fn save_project(conn: &Connection, user: &User, p: &Project, now: i64) -> Result<i64, String> {
    check_business(user, &p.business)?;
    if p.name.trim().is_empty() {
        return Err("Enter a project name.".into());
    }
    if contact(conn, p.contact_id)?.is_none() {
        return Err("Pick a contact.".into());
    }
    if !["none", "sent", "revise", "approved"].contains(&p.proof.as_str()) || !["open", "delivered", "closed"].contains(&p.status.as_str()) {
        return Err("Unknown proof or status.".into());
    }
    if !p.in_hands.is_empty() && days_between(&p.in_hands, &p.in_hands).is_none() {
        return Err("Enter the in-hands date as a date.".into());
    }
    if p.id == 0 {
        // A project that starts with changes asked has had at least one revision.
        let revisions = if p.proof == "revise" { p.revisions.max(1) } else { p.revisions };
        conn.execute(
            "INSERT INTO projects (name, contact_id, quote_id, business, art_link, art_ok, proof, revisions, in_hands, status, notes, created_by, created_at, updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)",
            params![p.name.trim(), p.contact_id, p.quote_id, p.business, p.art_link.trim(), p.art_ok as i64, p.proof, revisions, p.in_hands, p.status, p.notes, user.id, now],
        )
        .map_err(err)?;
        let id = conn.last_insert_rowid();
        log(conn, now, &user.id, "created", "project", Some(id), p.name.trim())?;
        Ok(id)
    } else {
        let before: (String, i64) = conn
            .query_row("SELECT proof, revisions FROM projects WHERE id = ?1", params![p.id], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(err)?;
        // A proof sent back for changes counts one revision.
        let revisions = if p.proof == "revise" && before.0 != "revise" { before.1 + 1 } else { before.1 };
        conn.execute(
            "UPDATE projects SET name=?2, contact_id=?3, business=?4, art_link=?5, art_ok=?6, proof=?7, revisions=?8, in_hands=?9, status=?10, notes=?11, updated_at=?12 WHERE id=?1",
            params![p.id, p.name.trim(), p.contact_id, p.business, p.art_link.trim(), p.art_ok as i64, p.proof, revisions, p.in_hands, p.status, p.notes, now],
        )
        .map_err(err)?;
        log(conn, now, &user.id, "edited", "project", Some(p.id), &format!("proof {}", p.proof))?;
        Ok(p.id)
    }
}

pub fn project_from_quote(conn: &Connection, user: &User, quote_id: i64, now: i64) -> Result<i64, String> {
    let q = quote(conn, user, quote_id)?;
    if q.status != "won" {
        return Err("Only a won quote becomes a project.".into());
    }
    let exists: i64 = conn.query_row("SELECT COUNT(*) FROM projects WHERE quote_id = ?1", params![quote_id], |r| r.get(0)).map_err(err)?;
    if exists > 0 {
        return Err("This quote already has a project.".into());
    }
    let name = q.lines.first().map(|l| format!("{} {}", q.number, l.item)).unwrap_or(q.number.clone());
    let art = q.checklist.get("art").and_then(|v| v.as_bool()).unwrap_or(false);
    save_project(
        conn,
        user,
        &Project {
            id: 0,
            name,
            contact_id: q.contact_id,
            contact: String::new(),
            quote_id: Some(quote_id),
            business: q.business,
            art_link: String::new(),
            art_ok: false,
            proof: "none".into(),
            revisions: 0,
            in_hands: String::new(),
            status: "open".into(),
            notes: if art { "Art received with the quote.".into() } else { String::new() },
            sample: false,
        },
        now,
    )
}

// ---------- Decision log ----------

#[derive(Debug, Clone, Serialize)]
pub struct LogRow {
    pub at: i64,
    pub user: String,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<i64>,
    pub detail: String,
}

pub fn decision_log(conn: &Connection, user: &User, limit: i64) -> Result<Vec<LogRow>, String> {
    if !user.is_owner() {
        return Err("Only the owner sees the full decision log.".into());
    }
    let mut stmt = conn
        .prepare("SELECT l.at, COALESCE(u.name, l.user_id), l.action, l.entity, l.entity_id, l.detail FROM decision_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT ?1")
        .map_err(err)?;
    let rows = stmt
        .query_map(params![limit], |r| Ok(LogRow { at: r.get(0)?, user: r.get(1)?, action: r.get(2)?, entity: r.get(3)?, entity_id: r.get(4)?, detail: r.get(5)? }))
        .map_err(err)?;
    rows.collect::<Result<_, _>>().map_err(err)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::auth::add_user;
    use crate::db::open_memory;

    pub fn people() -> (Connection, User, User) {
        let conn = open_memory().unwrap();
        let owner = add_user(&conn, None, "Owner Test", "owner", &[], "SYNTHETIC-pass-1").unwrap();
        let staff = add_user(&conn, Some(&owner), "Staff Test", "staff", &["FB".into()], "SYNTHETIC-pass-1").unwrap();
        (conn, owner, staff)
    }

    pub fn a_contact(conn: &Connection, user: &User, business: &str) -> i64 {
        save_contact(conn, user, &Contact { name: "Pat Sample".into(), company: "Sample Tavern".into(), email: "pat@example.com".into(), businesses: vec![business.into()], ..Default::default() }, 100).unwrap()
    }

    fn all_checked() -> serde_json::Value {
        quote::CHECKLIST.iter().map(|(k, _)| (k.to_string(), serde_json::Value::Bool(true))).collect::<serde_json::Map<_, _>>().into()
    }

    fn input(contact_id: i64, checklist: serde_json::Value) -> QuoteInput {
        QuoteInput {
            id: 0,
            contact_id,
            business: "FB".into(),
            lines: vec![Line { item: "Pint glass".into(), vendor: "V".into(), decoration: "Etch".into(), qty: 48, unit_cost_cents: 400, unit_price_cents: 900, taxable: true }],
            checklist,
            notes: String::new(),
            requested_at: Some(50),
        }
    }

    #[test]
    fn staff_only_sees_their_business() {
        let (conn, owner, staff) = people();
        a_contact(&conn, &owner, "WH");
        a_contact(&conn, &owner, "FB");
        assert_eq!(contacts(&conn, &owner).unwrap().len(), 2);
        assert_eq!(contacts(&conn, &staff).unwrap().len(), 1);
        assert!(save_contact(&conn, &staff, &Contact { name: "X".into(), email: "x@example.com".into(), businesses: vec!["WH".into()], ..Default::default() }, 1).is_err());
    }

    #[test]
    fn contact_needs_a_way_to_reach_them() {
        let (conn, owner, _) = people();
        let c = Contact { name: "No Reach".into(), businesses: vec!["FB".into()], ..Default::default() };
        assert!(save_contact(&conn, &owner, &c, 1).is_err());
    }

    #[test]
    fn staff_quote_waits_for_owner_and_checklist_blocks() {
        let (conn, owner, staff) = people();
        let c = a_contact(&conn, &owner, "FB");
        let id = save_quote(&conn, &staff, &input(c, serde_json::json!({})), 200).unwrap();
        assert!(quote_action(&conn, &staff, id, "submit", 210).unwrap_err().contains("checklist"));
        save_quote(&conn, &staff, &QuoteInput { id, ..input(c, all_checked()) }, 220).unwrap();
        assert_eq!(quote_action(&conn, &staff, id, "submit", 230).unwrap(), "waiting_approval");
        assert!(quote_action(&conn, &staff, id, "approve", 240).is_err());
        assert_eq!(quote_action(&conn, &owner, id, "approve", 250).unwrap(), "approved");
        assert!(quote_action(&conn, &staff, id, "won", 260).is_err(), "must be sent first");
        quote_action(&conn, &staff, id, "mark_sent", 270).unwrap();
        quote_action(&conn, &staff, id, "won", 280).unwrap();
        let inv = invoice_from_quote(&conn, &staff, id, "2026-12-15", 290).unwrap();
        assert!(invoice_from_quote(&conn, &staff, id, "2026-12-15", 291).is_err());
        let p = project_from_quote(&conn, &staff, id, 300).unwrap();
        assert!(inv > 0 && p > 0);
        assert!(decision_log(&conn, &owner, 50).unwrap().len() >= 8);
    }

    #[test]
    fn owner_quote_within_rules_approves_itself() {
        let (conn, owner, _) = people();
        let c = a_contact(&conn, &owner, "FB");
        let id = save_quote(&conn, &owner, &input(c, all_checked()), 200).unwrap();
        assert_eq!(quote_action(&conn, &owner, id, "submit", 210).unwrap(), "approved");
    }

    #[test]
    fn sent_quote_cannot_be_edited() {
        let (conn, owner, _) = people();
        let c = a_contact(&conn, &owner, "FB");
        let id = save_quote(&conn, &owner, &input(c, all_checked()), 200).unwrap();
        quote_action(&conn, &owner, id, "submit", 210).unwrap();
        quote_action(&conn, &owner, id, "mark_sent", 220).unwrap();
        assert!(save_quote(&conn, &owner, &QuoteInput { id, ..input(c, all_checked()) }, 230).is_err());
    }

    #[test]
    fn overdue_days_and_paid() {
        let (conn, owner, _) = people();
        let c = a_contact(&conn, &owner, "WH");
        let id = save_invoice(&conn, &owner, &Invoice { id: 0, number: String::new(), contact_id: c, contact: String::new(), quote_id: None, business: "WH".into(), amount_cents: 9900, status: "draft".into(), repeat: "monthly".into(), due_date: "2026-11-01".into(), pay_via: "Zelle".into(), notes: String::new(), overdue_days: 0, sample: false }, 1).unwrap();
        invoice_action(&conn, &owner, id, "mark_sent", 2).unwrap();
        assert_eq!(invoices(&conn, &owner, "2026-11-07").unwrap()[0].overdue_days, 6);
        invoice_action(&conn, &owner, id, "mark_paid", 3).unwrap();
        assert_eq!(invoices(&conn, &owner, "2026-11-07").unwrap()[0].overdue_days, 0);
    }

    #[test]
    fn revise_counts_one_revision() {
        let (conn, owner, _) = people();
        let c = a_contact(&conn, &owner, "FB");
        let mut p = Project { id: 0, name: "Hats".into(), contact_id: c, contact: String::new(), quote_id: None, business: "FB".into(), art_link: String::new(), art_ok: false, proof: "sent".into(), revisions: 0, in_hands: "2026-12-10".into(), status: "open".into(), notes: String::new(), sample: false };
        p.id = save_project(&conn, &owner, &p, 1).unwrap();
        p.proof = "revise".into();
        save_project(&conn, &owner, &p, 2).unwrap();
        save_project(&conn, &owner, &p, 3).unwrap();
        assert_eq!(projects(&conn, &owner).unwrap()[0].revisions, 1);
    }

    #[test]
    fn project_created_with_changes_asked_counts_one_revision() {
        let (conn, owner, _) = people();
        let c = a_contact(&conn, &owner, "FB");
        let p = Project { id: 0, name: "Aprons".into(), contact_id: c, contact: String::new(), quote_id: None, business: "FB".into(), art_link: String::new(), art_ok: false, proof: "revise".into(), revisions: 0, in_hands: String::new(), status: "open".into(), notes: String::new(), sample: false };
        save_project(&conn, &owner, &p, 1).unwrap();
        assert_eq!(projects(&conn, &owner).unwrap()[0].revisions, 1);
    }

    #[test]
    fn duplicates_by_email() {
        let (conn, owner, _) = people();
        a_contact(&conn, &owner, "FB");
        a_contact(&conn, &owner, "WH");
        assert_eq!(duplicates(&conn, &owner).unwrap().len(), 1);
    }

    #[test]
    fn day_math() {
        assert_eq!(days_between("2026-11-01", "2026-12-01"), Some(30));
        assert_eq!(days_between("2024-02-28", "2024-03-01"), Some(2));
        assert_eq!(days_between("nope", "2026-01-01"), None);
    }
}
