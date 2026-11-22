//! FAB Intel desktop shell. Each command opens the one database, checks who is signed in,
//! and passes the call to fab-core. No business rule lives here.

use fab_core::{auth, brief, db, records, roi, sample, settings};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

pub struct AppState {
    conn: Mutex<Connection>,
}

type Out = Result<Value, String>;

fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

fn to_json<T: serde::Serialize>(v: T) -> Out {
    serde_json::to_value(v).map_err(|e| e.to_string())
}

/// Runs `f` for the signed-in user, or refuses.
fn signed_in<T: serde::Serialize>(state: &State<AppState>, f: impl FnOnce(&Connection, &auth::User) -> Result<T, String>) -> Out {
    let conn = state.conn.lock().map_err(|_| "The database is busy. Try again.".to_string())?;
    let user = auth::current(&conn, now())?.ok_or("Sign in to use FAB Intel.")?;
    to_json(f(&conn, &user)?)
}

#[tauri::command]
fn status(state: State<AppState>) -> Out {
    let conn = state.conn.lock().map_err(|_| "The database is busy.".to_string())?;
    let user = auth::current(&conn, now())?;
    let users: Vec<Value> = auth::users(&conn)?
        .into_iter()
        .filter(|u| u.active)
        .map(|u| json!({"id": u.id, "name": u.name}))
        .collect();
    Ok(json!({
        "needs_setup": auth::needs_setup(&conn),
        "user": user,
        "users": users,
        "sample": sample::has_sample(&conn),
        "version": fab_core::VERSION,
        "commit": env!("FAB_GIT_SHA"),
    }))
}

#[tauri::command]
fn setup_owner(state: State<AppState>, name: String, password: String) -> Out {
    let conn = state.conn.lock().map_err(|_| "The database is busy.".to_string())?;
    let user = auth::add_user(&conn, None, &name, "owner", &[], &password)?;
    auth::sign_in(&conn, &user.id, &password, now())?;
    db::log(&conn, now(), &user.id, "created owner", "user", None, &user.name)?;
    to_json(user)
}

#[tauri::command]
fn sign_in(state: State<AppState>, user_id: String, password: String) -> Out {
    let conn = state.conn.lock().map_err(|_| "The database is busy.".to_string())?;
    let user = auth::sign_in(&conn, &user_id, &password, now())?;
    db::log(&conn, now(), &user.id, "signed in", "user", None, "")?;
    to_json(user)
}

#[tauri::command]
fn sign_out(state: State<AppState>) -> Out {
    let conn = state.conn.lock().map_err(|_| "The database is busy.".to_string())?;
    auth::sign_out(&conn)?;
    Ok(Value::Null)
}

#[tauri::command]
fn users_list(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| {
        if !u.is_owner() {
            return Err("Only the owner manages users.".into());
        }
        auth::users(conn)
    })
}

#[tauri::command]
fn user_add(state: State<AppState>, name: String, role: String, businesses: Vec<String>, password: String) -> Out {
    signed_in(&state, |conn, u| {
        let added = auth::add_user(conn, Some(u), &name, &role, &businesses, &password)?;
        db::log(conn, now(), &u.id, "added user", "user", None, &format!("{} ({})", added.name, added.role))?;
        Ok(added)
    })
}

#[tauri::command]
fn user_set_active(state: State<AppState>, id: String, active: bool) -> Out {
    signed_in(&state, |conn, u| {
        auth::set_active(conn, u, &id, active)?;
        db::log(conn, now(), &u.id, if active { "turned on user" } else { "turned off user" }, "user", None, &id)
    })
}

#[tauri::command]
fn user_set_password(state: State<AppState>, id: String, password: String) -> Out {
    signed_in(&state, |conn, u| {
        if !u.is_owner() && u.id != id {
            return Err("Only the owner can set another person's password.".into());
        }
        auth::set_password(conn, &id, &password)?;
        db::log(conn, now(), &u.id, "set password", "user", None, &id)
    })
}

#[tauri::command]
fn contacts_list(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| records::contacts(conn, u))
}

#[tauri::command]
fn contact_save(state: State<AppState>, contact: records::Contact) -> Out {
    signed_in(&state, |conn, u| records::save_contact(conn, u, &contact, now()))
}

#[tauri::command]
fn contacts_duplicates(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| records::duplicates(conn, u))
}

#[tauri::command]
fn quotes_list(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| records::quotes(conn, u))
}

#[tauri::command]
fn quote_save(state: State<AppState>, quote: records::QuoteInput) -> Out {
    signed_in(&state, |conn, u| records::save_quote(conn, u, &quote, now()))
}

#[tauri::command]
fn quote_action(state: State<AppState>, id: i64, action: String) -> Out {
    signed_in(&state, |conn, u| records::quote_action(conn, u, id, &action, now()))
}

#[tauri::command]
fn invoice_from_quote(state: State<AppState>, quote_id: i64, due_date: String) -> Out {
    signed_in(&state, |conn, u| records::invoice_from_quote(conn, u, quote_id, &due_date, now()))
}

#[tauri::command]
fn project_from_quote(state: State<AppState>, quote_id: i64) -> Out {
    signed_in(&state, |conn, u| records::project_from_quote(conn, u, quote_id, now()))
}

#[tauri::command]
fn invoices_list(state: State<AppState>, today: String) -> Out {
    signed_in(&state, |conn, u| records::invoices(conn, u, &today))
}

#[tauri::command]
fn invoice_save(state: State<AppState>, invoice: records::Invoice) -> Out {
    signed_in(&state, |conn, u| records::save_invoice(conn, u, &invoice, now()))
}

#[tauri::command]
fn invoice_action(state: State<AppState>, id: i64, action: String) -> Out {
    signed_in(&state, |conn, u| records::invoice_action(conn, u, id, &action, now()))
}

#[tauri::command]
fn projects_list(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| records::projects(conn, u))
}

#[tauri::command]
fn project_save(state: State<AppState>, project: records::Project) -> Out {
    signed_in(&state, |conn, u| records::save_project(conn, u, &project, now()))
}

#[tauri::command]
fn brief_items(state: State<AppState>, today: String) -> Out {
    signed_in(&state, |conn, u| brief::brief(conn, u, &today, now()))
}

#[tauri::command]
fn roi_rows(state: State<AppState>, today: String) -> Out {
    signed_in(&state, |conn, u| roi::roi(conn, u, &today, now()))
}

#[tauri::command]
fn baseline_set(state: State<AppState>, key: String, value: Option<f64>, note: String) -> Out {
    signed_in(&state, |conn, u| {
        roi::set_baseline(conn, u, &key, value, &note)?;
        db::log(conn, now(), &u.id, "set starting number", "roi", None, &key)
    })
}

#[tauri::command]
fn rules_get(state: State<AppState>) -> Out {
    signed_in(&state, |conn, _| Ok(settings::rules(conn)))
}

#[tauri::command]
fn rule_set(state: State<AppState>, key: String, value: String) -> Out {
    signed_in(&state, |conn, u| {
        settings::set(conn, u.is_owner(), &key, &value)?;
        db::log(conn, now(), &u.id, "changed rule", "rules", None, &format!("{key} = {value}"))
    })
}

#[tauri::command]
fn log_list(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| records::decision_log(conn, u, 200))
}

#[tauri::command]
fn sample_load(state: State<AppState>, today: String) -> Out {
    signed_in(&state, |conn, u| sample::load(conn, u, now(), &today))
}

#[tauri::command]
fn sample_clear(state: State<AppState>) -> Out {
    signed_in(&state, |conn, u| sample::clear(conn, u))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let path = dir.join("fab-intel.db");
            let conn = db::open(path.to_str().ok_or("The data folder path is not valid text.")?)?;
            app.manage(AppState { conn: Mutex::new(conn) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            status,
            setup_owner,
            sign_in,
            sign_out,
            users_list,
            user_add,
            user_set_active,
            user_set_password,
            contacts_list,
            contact_save,
            contacts_duplicates,
            quotes_list,
            quote_save,
            quote_action,
            invoice_from_quote,
            project_from_quote,
            invoices_list,
            invoice_save,
            invoice_action,
            projects_list,
            project_save,
            brief_items,
            roi_rows,
            baseline_set,
            rules_get,
            rule_set,
            log_list,
            sample_load,
            sample_clear
        ])
        .run(tauri::generate_context!())
        .expect("FAB Intel could not start");
}
