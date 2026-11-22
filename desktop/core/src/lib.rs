//! FAB Intel desktop core. Built from the Dr. Data MVP Hub patterns:
//! one local SQLite database, sign-in with roles, a decision log, rules in code, and an ROI page.
//! The Tauri shell in ../src-tauri only passes calls through to this crate.

pub mod auth;
pub mod brief;
pub mod db;
pub mod quote;
pub mod records;
pub mod roi;
pub mod sample;
pub mod settings;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
