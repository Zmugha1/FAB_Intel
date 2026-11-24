// FAB Intel on the Dr. Data Hub (Build Rules 2.1). The Hub is the app. This crate adds the
// client's own name, screens and quote check through the extension contract.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pricing;

use hub_app_lib::extension::{ExtCommand, ExtMigration, Extension};

fn extension() -> Extension {
    Extension {
        provider: "fab_intel",
        parts: &[pricing::PART],
        commands: vec![
            ExtCommand { name: "ext.pricing.check", part: pricing::PART, pages: &[pricing::PAGE], run: pricing::run_check },
            ExtCommand { name: "ext.pricing.recent", part: pricing::PART, pages: &[pricing::PAGE], run: pricing::run_recent },
            ExtCommand { name: "ext.pricing.destinations", part: pricing::PART, pages: &[pricing::PAGE], run: pricing::run_destinations },
        ],
        migrations: vec![ExtMigration { name: "001_quote_check", sql: pricing::MIGRATION }],
    }
}

fn main() {
    hub_app_lib::start(Some(hub_app_lib::ClientApp { context: || tauri::generate_context!(), extensions: vec![extension()] }));
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_extension_is_valid() {
        assert!(hub_app_lib::extension::problems(&[super::extension()]).is_empty());
    }
}
