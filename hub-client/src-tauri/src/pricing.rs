//! FAB Intel quote check. Client-only rules behind the Hub's extension contract (Build Rules 2.2).
//!
//! Every number here is the owner's, from her written answers of November 23, 2026:
//! gross profit margin, not markup; 25% is the floor (a hold unless she authorized an exception in
//! advance); 35% is the approval line; no inventory holds the quote; missing artwork and missing
//! shipping or setup fees are alerts; any discount is flagged; and until the quote process is in
//! place she approves every quote. Sales tax follows the delivery destination.
//!
//! Her words to avoid: "stop" (say a person decides) and "markup" (say gross profit margin).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Below this gross profit margin the quote is held unless an exception was authorized in advance.
pub const FLOOR: f64 = 0.25;
/// Below this gross profit margin the quote needs the owner's eyes.
pub const APPROVAL_LINE: f64 = 0.35;

pub const PART: &str = "ext.pricing";
pub const PAGE: &str = "ext.pricing.quote_check";

/// Sales tax by where the order ships, not the billing address. Her rates.
pub const DESTINATIONS: &[(&str, &str, f64)] = &[
    ("city_of_milwaukee", "City of Milwaukee", 0.079),
    ("milwaukee_county", "Milwaukee County, outside the city", 0.059),
    ("racine_county", "Racine County", 0.055),
    ("elsewhere", "Elsewhere in Wisconsin", 0.05),
    ("nonprofit", "Nonprofit with the exemption form", 0.0),
];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    #[serde(default)]
    pub label: String,
    /// product, setup, shipping, artwork or other.
    #[serde(default)]
    pub kind: String,
    pub qty: f64,
    pub unit_cost: f64,
    pub unit_price: f64,
    #[serde(default = "yes")]
    pub taxable: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteInput {
    pub lines: Vec<Line>,
    /// Dollars off the quote. Any discount needs the owner's approval.
    #[serde(default)]
    pub discount: f64,
    pub destination: String,
    #[serde(default)]
    pub inventory_confirmed: bool,
    #[serde(default)]
    pub artwork_attached: bool,
    /// line, zero, or bill after delivery. Anything else is missing.
    #[serde(default)]
    pub shipping: String,
    /// line or zero. Anything else is missing.
    #[serde(default)]
    pub setup: String,
    /// The owner authorized a margin below the floor before the quote was built.
    #[serde(default)]
    pub exception_authorized: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteCheck {
    pub subtotal: f64,
    pub discount: f64,
    pub taxable: f64,
    pub tax_rate: f64,
    pub tax: f64,
    pub total: f64,
    pub cost: f64,
    pub gross_profit: f64,
    /// Gross profit over the price after discount. None when the price is zero.
    pub gross_margin: Option<f64>,
    /// hold: a person decides before anything else happens. approval: the owner approves.
    pub suggestion: String,
    /// Why, in the order it was decided. Always shown.
    pub reasoning: Vec<String>,
    pub alerts: Vec<String>,
    /// A follow-up invoice is needed for shipping billed after delivery.
    pub follow_up_invoice: bool,
}

fn cents(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn percent(value: f64) -> String {
    format!("{:.1}%", value * 100.0)
}

pub fn check(input: &QuoteInput) -> Result<QuoteCheck, String> {
    if input.lines.is_empty() {
        return Err("Add at least one line.".to_owned());
    }
    for line in &input.lines {
        if line.qty < 0.0 || line.unit_cost < 0.0 || line.unit_price < 0.0 || !line.qty.is_finite() {
            return Err(format!("Line {} has a negative or missing number.", line.label));
        }
    }
    if input.discount < 0.0 {
        return Err("A discount is a positive number of dollars.".to_owned());
    }
    let Some((_, place, tax_rate)) = DESTINATIONS.iter().find(|(id, _, _)| *id == input.destination) else {
        return Err("Pick where the order ships.".to_owned());
    };
    let subtotal: f64 = input.lines.iter().map(|line| line.qty * line.unit_price).sum();
    let cost: f64 = input.lines.iter().map(|line| line.qty * line.unit_cost).sum();
    let taxable_lines: f64 = input.lines.iter().filter(|line| line.taxable).map(|line| line.qty * line.unit_price).sum();
    let discount = input.discount.min(subtotal);
    let price = subtotal - discount;
    // The discount is spread over the lines by value, so the taxable share shrinks with it.
    let taxable = if subtotal > 0.0 { taxable_lines * price / subtotal } else { 0.0 };
    let tax = cents(taxable * tax_rate);
    let gross_profit = price - cost;
    let gross_margin = if price > 0.0 { Some(gross_profit / price) } else { None };

    let mut reasoning = Vec::new();
    let mut alerts = Vec::new();
    let mut hold = false;
    match gross_margin {
        None => {
            hold = true;
            reasoning.push("The quote has no price, so there is no gross profit margin. A person decides.".to_owned());
        }
        Some(margin) if margin < FLOOR && !input.exception_authorized => {
            hold = true;
            reasoning.push(format!(
                "Gross profit margin is {}, under the 25% floor, and no exception was authorized in advance. A person decides.",
                percent(margin)
            ));
        }
        Some(margin) if margin < FLOOR => {
            reasoning.push(format!("Gross profit margin is {}, under the 25% floor. The owner authorized this exception in advance.", percent(margin)));
        }
        Some(margin) if margin < APPROVAL_LINE => {
            reasoning.push(format!("Gross profit margin is {}, under the 35% approval line. The owner looks at it.", percent(margin)));
        }
        Some(margin) => {
            reasoning.push(format!("Gross profit margin is {}, at or above the 35% approval line.", percent(margin)));
        }
    }
    if !input.inventory_confirmed {
        hold = true;
        reasoning.push("Inventory is not confirmed. No inventory holds the quote. Check it again at the moment of ordering.".to_owned());
    }
    if discount > 0.0 {
        reasoning.push(format!("A discount of ${discount:.2} is on the quote. Any discount needs the owner's approval."));
    }
    if !input.artwork_attached {
        alerts.push("Artwork is not attached. Vector art is needed for print and embroidery.".to_owned());
    }
    let follow_up_invoice = match input.shipping.as_str() {
        "line" | "zero" => false,
        "bill after delivery" => {
            alerts.push("Shipping is billed after delivery. A follow-up invoice will be needed.".to_owned());
            true
        }
        _ => {
            alerts.push("Shipping is missing. Add a line, or enter zero, or bill after delivery.".to_owned());
            false
        }
    };
    if !matches!(input.setup.as_str(), "line" | "zero") {
        alerts.push("The setup fee is missing. Add a line or enter zero.".to_owned());
    }
    if input.destination == "elsewhere" {
        alerts.push("Elsewhere uses the 5% rate from the owner's answers. Most Wisconsin counties add 0.5% county tax. Confirm the rate for this county.".to_owned());
    }
    if input.destination == "nonprofit" {
        alerts.push("No tax for a nonprofit only with the Wisconsin exemption form on file.".to_owned());
    }
    reasoning.push(format!("Tax: {} at {} on ${:.2} taxable.", place, percent(*tax_rate), cents(taxable)));
    reasoning.push("Every quote goes to the owner before it is sent, until the quote process is in place.".to_owned());

    Ok(QuoteCheck {
        subtotal: cents(subtotal),
        discount: cents(discount),
        taxable: cents(taxable),
        tax_rate: *tax_rate,
        tax,
        total: cents(price + tax),
        cost: cents(cost),
        gross_profit: cents(gross_profit),
        gross_margin,
        suggestion: if hold { "hold" } else { "approval" }.to_owned(),
        reasoning,
        alerts,
        follow_up_invoice,
    })
}

pub const MIGRATION: &str = "CREATE TABLE IF NOT EXISTS ext_fab_quote_check (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    input TEXT NOT NULL,
    result TEXT NOT NULL
);";

pub fn run_check(ctx: &hub_app_lib::extension::ExtCtx, input: &Value) -> Result<Value, String> {
    let quote: QuoteInput = serde_json::from_value(input.clone()).map_err(|error| format!("The quote could not be read. {error}"))?;
    let result = check(&quote)?;
    let (user, role) = ctx.user.as_ref().map(|user| (user.id.clone(), user.role.clone())).unwrap_or_default();
    let result_json = serde_json::to_value(&result).map_err(|error| error.to_string())?;
    ctx.conn
        .execute(
            "INSERT INTO ext_fab_quote_check (at, user_id, role, input, result) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![ctx.now, user, role, input.to_string(), result_json.to_string()],
        )
        .map_err(|error| error.to_string())?;
    Ok(result_json)
}

pub fn run_recent(ctx: &hub_app_lib::extension::ExtCtx, _input: &Value) -> Result<Value, String> {
    let mut statement = ctx
        .conn
        .prepare("SELECT id, at, role, result FROM ext_fab_quote_check ORDER BY id DESC LIMIT 20")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let result: String = row.get(3)?;
            Ok(json!({ "id": row.get::<_, i64>(0)?, "at": row.get::<_, i64>(1)?, "role": row.get::<_, String>(2)?, "result": serde_json::from_str::<Value>(&result).unwrap_or(Value::Null) }))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(Value::Array(rows))
}

pub fn run_destinations(_ctx: &hub_app_lib::extension::ExtCtx, _input: &Value) -> Result<Value, String> {
    Ok(Value::Array(DESTINATIONS.iter().map(|(id, label, rate)| json!({ "id": id, "label": label, "rate": rate })).collect()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(qty: f64, cost: f64, price: f64) -> Line {
        Line { label: "SYNTHETIC tee".to_owned(), kind: "product".to_owned(), qty, unit_cost: cost, unit_price: price, taxable: true }
    }

    fn quote(lines: Vec<Line>) -> QuoteInput {
        QuoteInput {
            lines,
            discount: 0.0,
            destination: "racine_county".to_owned(),
            inventory_confirmed: true,
            artwork_attached: true,
            shipping: "line".to_owned(),
            setup: "zero".to_owned(),
            exception_authorized: false,
        }
    }

    #[test]
    fn her_tax_examples_on_a_100_dollar_order() {
        for (destination, tax) in [("racine_county", 5.50), ("milwaukee_county", 5.90), ("city_of_milwaukee", 7.90)] {
            let mut input = quote(vec![line(1.0, 50.0, 100.0)]);
            input.destination = destination.to_owned();
            let result = check(&input).unwrap();
            assert_eq!(result.tax, tax, "{destination}");
            assert_eq!(result.total, 100.0 + tax, "{destination}");
        }
    }

    #[test]
    fn under_the_floor_is_held_unless_authorized_in_advance() {
        let input = quote(vec![line(10.0, 8.0, 10.0)]);
        let result = check(&input).unwrap();
        assert_eq!(result.suggestion, "hold");
        assert!(result.reasoning[0].contains("20.0%"), "{:?}", result.reasoning);
        let mut authorized = input;
        authorized.exception_authorized = true;
        assert_eq!(check(&authorized).unwrap().suggestion, "approval");
    }

    #[test]
    fn between_the_floor_and_the_line_goes_to_the_owner() {
        let result = check(&quote(vec![line(10.0, 7.0, 10.0)])).unwrap();
        assert_eq!(result.suggestion, "approval");
        assert!(result.reasoning[0].contains("35% approval line"), "{:?}", result.reasoning);
    }

    #[test]
    fn margin_is_gross_profit_over_price_not_markup() {
        let result = check(&quote(vec![line(1.0, 65.0, 100.0)])).unwrap();
        assert_eq!(result.gross_margin, Some(0.35));
    }

    #[test]
    fn no_inventory_holds_and_missing_items_alert() {
        let mut input = quote(vec![line(1.0, 10.0, 100.0)]);
        input.inventory_confirmed = false;
        input.artwork_attached = false;
        input.shipping = String::new();
        input.setup = String::new();
        let result = check(&input).unwrap();
        assert_eq!(result.suggestion, "hold");
        assert_eq!(result.alerts.len(), 3, "{:?}", result.alerts);
    }

    #[test]
    fn a_discount_is_flagged_and_lowers_margin_and_tax() {
        let mut input = quote(vec![line(1.0, 50.0, 100.0)]);
        input.discount = 10.0;
        let result = check(&input).unwrap();
        assert!(result.reasoning.iter().any(|item| item.contains("discount")));
        assert_eq!(result.taxable, 90.0);
        assert_eq!(result.gross_profit, 40.0);
    }

    #[test]
    fn shipping_billed_after_delivery_needs_a_follow_up_invoice() {
        let mut input = quote(vec![line(1.0, 10.0, 100.0)]);
        input.shipping = "bill after delivery".to_owned();
        assert!(check(&input).unwrap().follow_up_invoice);
    }

    #[test]
    fn the_word_stop_and_markup_never_reach_the_screen() {
        let mut input = quote(vec![line(10.0, 9.0, 10.0)]);
        input.inventory_confirmed = false;
        input.destination = "elsewhere".to_owned();
        let result = check(&input).unwrap();
        for text in result.reasoning.iter().chain(&result.alerts) {
            let lower = text.to_lowercase();
            assert!(!lower.contains("stop") && !lower.contains("markup"), "{text}");
        }
    }
}
