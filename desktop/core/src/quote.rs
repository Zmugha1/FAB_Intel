//! Quote math and the approval rule. Pure functions, no database.
//! Money is whole cents. Rates are basis points (100 bp = 1%).

use crate::settings::Rules;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Line {
    pub item: String,
    #[serde(default)]
    pub vendor: String,
    #[serde(default)]
    pub decoration: String,
    pub qty: i64,
    pub unit_cost_cents: i64,
    pub unit_price_cents: i64,
    #[serde(default = "yes")]
    pub taxable: bool,
}

fn yes() -> bool {
    true
}

/// The quote checklist from the STZ interview: what Lauren needs before a quote goes to Mary Jane.
pub const CHECKLIST: [(&str, &str); 6] = [
    ("shipping", "Shipping added"),
    ("less_than_minimum", "Less-than-minimum charge checked"),
    ("color_changes", "Color changes checked"),
    ("setup_fees", "Setup fees added"),
    ("in_hands", "In-hands date confirmed"),
    ("art", "Art received"),
];

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Totals {
    pub subtotal_cents: i64,
    pub cost_cents: i64,
    pub tax_cents: Option<i64>,
    pub total_cents: i64,
    /// Margin in basis points on the subtotal. None when the subtotal is zero.
    pub margin_bp: Option<i64>,
}

pub fn totals(lines: &[Line], tax_rate_bp: Option<i64>) -> Totals {
    let subtotal: i64 = lines.iter().map(|l| l.qty * l.unit_price_cents).sum();
    let cost: i64 = lines.iter().map(|l| l.qty * l.unit_cost_cents).sum();
    let taxable: i64 = lines.iter().filter(|l| l.taxable).map(|l| l.qty * l.unit_price_cents).sum();
    // Round half up to the cent.
    let tax = tax_rate_bp.map(|bp| (taxable * bp + 5_000) / 10_000);
    let margin = if subtotal > 0 { Some(((subtotal - cost) * 10_000) / subtotal) } else { None };
    Totals { subtotal_cents: subtotal, cost_cents: cost, tax_cents: tax, total_cents: subtotal + tax.unwrap_or(0), margin_bp: margin }
}

/// Why a quote needs the owner, in plain words. Empty when it does not.
pub fn approval_reasons(t: &Totals, rules: &Rules, drafted_by_staff: bool) -> Vec<String> {
    let mut reasons = Vec::new();
    if drafted_by_staff && rules.staff_quotes_need_owner {
        reasons.push("Drafted by staff. The owner approves every staff quote.".to_owned());
    }
    if let Some(m) = t.margin_bp {
        if m < rules.margin_floor_bp {
            reasons.push(format!("Margin {} is under the {} floor.", pct(m), pct(rules.margin_floor_bp)));
        }
    }
    if t.total_cents > rules.approve_over_cents {
        reasons.push(format!("Total {} is over the {} limit.", money(t.total_cents), money(rules.approve_over_cents)));
    }
    reasons
}

/// Checklist items still open. A quote cannot go for approval or be sent until this is empty.
pub fn open_checklist(checklist: &serde_json::Value) -> Vec<&'static str> {
    CHECKLIST
        .iter()
        .filter(|(key, _)| !checklist.get(*key).and_then(|v| v.as_bool()).unwrap_or(false))
        .map(|(_, label)| *label)
        .collect()
}

pub fn pct(bp: i64) -> String {
    if bp % 100 == 0 {
        format!("{}%", bp / 100)
    } else {
        format!("{:.1}%", bp as f64 / 100.0)
    }
}

pub fn money(cents: i64) -> String {
    let neg = cents < 0;
    let c = cents.abs();
    let dollars = c / 100;
    let mut s = dollars.to_string();
    let mut i = s.len() as i64 - 3;
    while i > 0 {
        s.insert(i as usize, ',');
        i -= 3;
    }
    format!("{}${}.{:02}", if neg { "-" } else { "" }, s, c % 100)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules() -> Rules {
        Rules { margin_floor_bp: 3500, approve_over_cents: 250_000, staff_quotes_need_owner: true, staff_see_costs: None, tax_rate_bp: Some(550), quote_valid_days: 14, follow_up_days: 3 }
    }

    fn line(qty: i64, cost: i64, price: i64, taxable: bool) -> Line {
        Line { item: "Tumbler".into(), vendor: String::new(), decoration: String::new(), qty, unit_cost_cents: cost, unit_price_cents: price, taxable }
    }

    #[test]
    fn totals_tax_and_margin() {
        // 100 tumblers at $17.00 cost, $26.00 price; one untaxed $50 setup fee at $0 cost.
        let t = totals(&[line(100, 1700, 2600, true), line(1, 0, 5000, false)], Some(550));
        assert_eq!(t.subtotal_cents, 265_000);
        assert_eq!(t.cost_cents, 170_000);
        assert_eq!(t.tax_cents, Some(14_300));
        assert_eq!(t.total_cents, 279_300);
        assert_eq!(t.margin_bp, Some(3584));
    }

    #[test]
    fn missing_tax_rate_stays_missing() {
        let t = totals(&[line(10, 100, 200, true)], None);
        assert_eq!(t.tax_cents, None);
        assert_eq!(t.total_cents, 2000);
    }

    #[test]
    fn staff_quotes_always_go_to_owner() {
        let t = totals(&[line(10, 100, 200, true)], Some(550));
        assert_eq!(approval_reasons(&t, &rules(), true).len(), 1);
        assert!(approval_reasons(&t, &rules(), false).is_empty());
    }

    #[test]
    fn floor_and_limit_trigger_for_owner_too() {
        let t = totals(&[line(200, 1500, 1800, true)], Some(550));
        let reasons = approval_reasons(&t, &rules(), false);
        assert!(reasons.iter().any(|r| r.contains("floor")));
        assert!(reasons.iter().any(|r| r.contains("limit")));
    }

    #[test]
    fn checklist_lists_open_items() {
        let v = serde_json::json!({"shipping": true, "art": true});
        assert_eq!(open_checklist(&v).len(), 4);
        let all: serde_json::Value = CHECKLIST.iter().map(|(k, _)| (k.to_string(), serde_json::Value::Bool(true))).collect::<serde_json::Map<_, _>>().into();
        assert!(open_checklist(&all).is_empty());
    }

    #[test]
    fn money_and_percent_format() {
        assert_eq!(money(392_000), "$3,920.00");
        assert_eq!(money(5), "$0.05");
        assert_eq!(pct(3500), "35%");
        assert_eq!(pct(3584), "35.8%");
    }
}
