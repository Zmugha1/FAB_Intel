//! The Morning Brief: what needs a person today, built from the records by code. No model writes it.

use crate::auth::User;
use crate::quote::{money, pct};
use crate::records::{days_between, invoices, projects, quotes};
use crate::settings::rules;
use rusqlite::Connection;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Item {
    /// "act" needs a decision today, "watch" is a follow-up, "gap" is missing setup.
    pub level: String,
    pub title: String,
    pub detail: String,
    pub view: String,
    pub business: String,
}

fn item(level: &str, title: String, detail: String, view: &str, business: &str) -> Item {
    Item { level: level.into(), title, detail, view: view.into(), business: business.into() }
}

pub fn brief(conn: &Connection, user: &User, today: &str, now: i64) -> Result<Vec<Item>, String> {
    let r = rules(conn);
    let mut out = Vec::new();

    if user.is_owner() && r.tax_rate_bp.is_none() {
        out.push(item("gap", "Answer: what is your sales tax rate?".into(), "Quotes show no tax until you answer on the Rules page, under Questions for you.".into(), "rules", ""));
    }
    if user.is_owner() && r.staff_see_costs.is_none() {
        out.push(item("gap", "Answer: should staff see vendor costs and margins?".into(), "Staff see them until you answer on the Rules page, under Questions for you.".into(), "rules", ""));
    }

    for q in quotes(conn, user)? {
        match q.status.as_str() {
            "waiting_approval" if user.is_owner() => out.push(item(
                "act",
                format!("Approve quote {}, {}", q.number, q.contact),
                q.needs_owner.join(" "),
                "quotes",
                &q.business,
            )),
            "waiting_approval" => out.push(item("watch", format!("Quote {} is with the owner", q.number), q.contact.clone(), "quotes", &q.business)),
            "approved" => out.push(item("act", format!("Send quote {}", q.number), format!("Approved. {} total {}.", q.contact, money(q.totals.total_cents)), "quotes", &q.business)),
            "sent" => {
                if let Some(sent) = q.sent_at {
                    let days = (now - sent) / 86_400;
                    if days >= r.follow_up_days {
                        let left = r.quote_valid_days - days;
                        let hold = if left > 0 { format!("Quote holds {left} more days.") } else { "Quote has expired.".to_owned() };
                        out.push(item("watch", format!("Follow up on quote {}, {}", q.number, q.contact), format!("Sent {days} days ago. {hold}"), "quotes", &q.business));
                    }
                }
            }
            "draft" if q.created_by == user.id => {
                if let Some(m) = q.totals.margin_bp {
                    if m < r.margin_floor_bp {
                        out.push(item("watch", format!("Draft {} is under the margin floor", q.number), format!("Margin {} against {}.", pct(m), pct(r.margin_floor_bp)), "quotes", &q.business));
                    }
                }
            }
            _ => {}
        }
    }

    for inv in invoices(conn, user, today)? {
        if inv.status == "sent" && inv.overdue_days > 0 {
            out.push(item(
                "act",
                format!("Invoice {} overdue {} days", inv.number, inv.overdue_days),
                format!("{}, {}.", inv.contact, money(inv.amount_cents)),
                "invoices",
                &inv.business,
            ));
        } else if inv.status == "draft" {
            out.push(item("watch", format!("Invoice {} is still a draft", inv.number), inv.contact.clone(), "invoices", &inv.business));
        }
    }

    for p in projects(conn, user)? {
        if p.status != "open" {
            continue;
        }
        if !p.in_hands.is_empty() {
            if let Some(days) = days_between(today, &p.in_hands) {
                if days <= 7 && p.proof != "approved" {
                    out.push(item("act", format!("{}: in-hands in {} days, proof not approved", p.name, days.max(0)), p.contact.clone(), "projects", &p.business));
                    continue;
                }
            }
        }
        if p.proof == "revise" {
            out.push(item("watch", format!("{}: proof needs changes", p.name), format!("Revision {}.", p.revisions), "projects", &p.business));
        } else if !p.art_ok && p.proof == "none" {
            out.push(item("watch", format!("{}: art not checked yet", p.name), p.contact.clone(), "projects", &p.business));
        }
    }

    if user.is_owner() {
        let empty: i64 = conn.query_row("SELECT COUNT(*) FROM roi_baseline WHERE value IS NULL", [], |r| r.get(0)).map_err(|e| e.to_string())?;
        if empty > 0 {
            out.push(item("gap", format!("{empty} starting numbers missing"), "Fill them on the ROI page so we can measure what FAB Intel saves.".into(), "roi", ""));
        }
    }

    let rank = |l: &str| match l {
        "act" => 0,
        "watch" => 1,
        _ => 2,
    };
    out.sort_by_key(|i| rank(&i.level));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quote::{Line, CHECKLIST};
    use crate::records::tests::{a_contact, people};
    use crate::records::{quote_action, save_quote, QuoteInput};

    #[test]
    fn owner_sees_approvals_and_gaps_staff_does_not_see_gaps() {
        let (conn, owner, staff) = people();
        let c = a_contact(&conn, &owner, "FB");
        let checked: serde_json::Value = CHECKLIST.iter().map(|(k, _)| (k.to_string(), serde_json::Value::Bool(true))).collect::<serde_json::Map<_, _>>().into();
        let id = save_quote(
            &conn,
            &staff,
            &QuoteInput { id: 0, contact_id: c, business: "FB".into(), lines: vec![Line { item: "Hat".into(), vendor: String::new(), decoration: String::new(), qty: 24, unit_cost_cents: 800, unit_price_cents: 1500, taxable: true }], checklist: checked, notes: String::new(), requested_at: None },
            10,
        )
        .unwrap();
        quote_action(&conn, &staff, id, "submit", 20).unwrap();
        let owner_items = brief(&conn, &owner, "2026-12-01", 30).unwrap();
        assert_eq!(owner_items[0].level, "act");
        assert!(owner_items[0].title.starts_with("Approve quote"));
        assert!(owner_items.iter().any(|i| i.level == "gap"));
        let staff_items = brief(&conn, &staff, "2026-12-01", 30).unwrap();
        assert!(staff_items.iter().all(|i| i.level != "gap"));
        assert!(staff_items.iter().any(|i| i.title.contains("with the owner")));
    }
}
