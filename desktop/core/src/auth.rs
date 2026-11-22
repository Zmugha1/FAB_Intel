//! Sign-in and roles. Adapted from the MVP Hub (storage/sign_in.rs, DD-ADR-073):
//! Argon2 password hashes, five wrong tries lock the account for five minutes,
//! and a session ends after 15 minutes idle.
//! It does not protect files from someone with access to the disk. BitLocker does that.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

pub const IDLE_SECONDS: i64 = 15 * 60;
pub const MAX_FAILS: i64 = 5;
pub const LOCK_SECONDS: i64 = 5 * 60;
pub const MIN_LENGTH: usize = 10;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct User {
    pub id: String,
    pub name: String,
    pub role: String,
    pub businesses: Vec<String>,
    pub has_password: bool,
    pub active: bool,
}

impl User {
    pub fn is_owner(&self) -> bool {
        self.role == "owner"
    }
    pub fn sees(&self, business: &str) -> bool {
        self.businesses.iter().any(|b| b == business)
    }
}

fn row_to_user(row: &rusqlite::Row) -> rusqlite::Result<User> {
    let businesses: String = row.get(3)?;
    Ok(User {
        id: row.get(0)?,
        name: row.get(1)?,
        role: row.get(2)?,
        businesses: businesses.split(',').filter(|s| !s.is_empty()).map(str::to_owned).collect(),
        has_password: row.get::<_, Option<String>>(4)?.is_some(),
        active: row.get::<_, i64>(5)? == 1,
    })
}

const USER_COLS: &str = "id, name, role, businesses, password_hash, active";

pub fn users(conn: &Connection) -> Result<Vec<User>, String> {
    let mut stmt = conn
        .prepare(&format!("SELECT {USER_COLS} FROM users ORDER BY role DESC, name"))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_user).map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

pub fn user(conn: &Connection, id: &str) -> Result<Option<User>, String> {
    conn.query_row(&format!("SELECT {USER_COLS} FROM users WHERE id = ?1"), params![id], row_to_user)
        .optional()
        .map_err(|e| e.to_string())
}

/// True until the first owner exists. The first-run screen creates that owner.
pub fn needs_setup(conn: &Connection) -> bool {
    conn.query_row("SELECT COUNT(*) FROM users WHERE role = 'owner'", [], |r| r.get::<_, i64>(0))
        .map(|n| n == 0)
        .unwrap_or(true)
}

fn slug(name: &str) -> String {
    let s: String = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    s.trim_matches('-').to_owned()
}

/// Adds a user. The first user must be the owner and needs no one signed in.
/// After that, only an owner may add users.
pub fn add_user(conn: &Connection, actor: Option<&User>, name: &str, role: &str, businesses: &[String], password: &str) -> Result<User, String> {
    if role != "owner" && role != "staff" {
        return Err("Role must be owner or staff.".into());
    }
    if needs_setup(conn) {
        if role != "owner" {
            return Err("The first user is the owner.".into());
        }
    } else if !actor.map(User::is_owner).unwrap_or(false) {
        return Err("Only the owner can add users.".into());
    }
    let id = slug(name);
    if id.is_empty() {
        return Err("Enter a name.".into());
    }
    if user(conn, &id)?.is_some() {
        return Err("A user with that name already exists.".into());
    }
    let list = if businesses.is_empty() { "FB,WH,WM".to_owned() } else { businesses.join(",") };
    conn.execute(
        "INSERT INTO users (id, name, role, businesses) VALUES (?1, ?2, ?3, ?4)",
        params![id, name.trim(), role, list],
    )
    .map_err(|e| e.to_string())?;
    if let Err(e) = set_password(conn, &id, password) {
        conn.execute("DELETE FROM users WHERE id = ?1", params![id]).ok();
        return Err(e);
    }
    user(conn, &id)?.ok_or_else(|| "User was not saved.".into())
}

pub fn set_active(conn: &Connection, actor: &User, id: &str, active: bool) -> Result<(), String> {
    if !actor.is_owner() {
        return Err("Only the owner can change users.".into());
    }
    if actor.id == id && !active {
        return Err("You cannot turn off your own account.".into());
    }
    conn.execute("UPDATE users SET active = ?2 WHERE id = ?1", params![id, active as i64])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn set_password(conn: &Connection, user_id: &str, password: &str) -> Result<(), String> {
    use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};
    if password.chars().count() < MIN_LENGTH {
        return Err(format!("A password needs at least {MIN_LENGTH} characters."));
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = argon2::Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();
    let changed = conn
        .execute(
            "UPDATE users SET password_hash = ?2, failed_count = 0, locked_until = 0 WHERE id = ?1 AND active = 1",
            params![user_id, hash],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("That user is not active.".into());
    }
    Ok(())
}

pub fn sign_in(conn: &Connection, user_id: &str, password: &str, now: i64) -> Result<User, String> {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    let row: Option<(Option<String>, i64, i64, i64)> = conn
        .query_row(
            "SELECT password_hash, failed_count, locked_until, active FROM users WHERE id = ?1",
            params![user_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some((hash, failed, locked_until, active)) = row else {
        return Err("Wrong user or password.".into());
    };
    if active == 0 {
        return Err("Wrong user or password.".into());
    }
    let Some(hash) = hash else {
        return Err("This user has no password yet. Ask the owner to set one.".into());
    };
    if locked_until > now {
        let minutes = (locked_until - now + 59) / 60;
        return Err(format!("Too many wrong passwords. Try again in {minutes} minutes."));
    }
    let parsed = PasswordHash::new(&hash).map_err(|e| e.to_string())?;
    if argon2::Argon2::default().verify_password(password.as_bytes(), &parsed).is_err() {
        let failed = failed + 1;
        let (count, until) = if failed >= MAX_FAILS { (0, now + LOCK_SECONDS) } else { (failed, 0) };
        conn.execute("UPDATE users SET failed_count = ?2, locked_until = ?3 WHERE id = ?1", params![user_id, count, until])
            .map_err(|e| e.to_string())?;
        return Err("Wrong user or password.".into());
    }
    conn.execute("UPDATE users SET failed_count = 0, locked_until = 0 WHERE id = ?1", params![user_id])
        .map_err(|e| e.to_string())?;
    conn.execute("UPDATE session SET user_id = ?1, last_seen = ?2 WHERE id = 1", params![user_id, now])
        .map_err(|e| e.to_string())?;
    user(conn, user_id)?.ok_or_else(|| "Wrong user or password.".into())
}

pub fn sign_out(conn: &Connection) -> Result<(), String> {
    conn.execute("UPDATE session SET user_id = NULL WHERE id = 1", [])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// The signed-in user, or None when nobody is signed in or the session went idle.
/// Each call that finds a user refreshes the idle clock.
pub fn current(conn: &Connection, now: i64) -> Result<Option<User>, String> {
    let row: (Option<String>, i64) = conn
        .query_row("SELECT user_id, last_seen FROM session WHERE id = 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?;
    let (Some(id), last_seen) = row else { return Ok(None) };
    if now - last_seen > IDLE_SECONDS {
        sign_out(conn)?;
        return Ok(None);
    }
    let found = user(conn, &id)?;
    match found {
        Some(u) if u.active => {
            conn.execute("UPDATE session SET last_seen = ?1 WHERE id = 1", params![now]).map_err(|e| e.to_string())?;
            Ok(Some(u))
        }
        _ => {
            sign_out(conn)?;
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_memory;

    const PW: &str = "SYNTHETIC-pass-1";

    fn setup() -> (Connection, User) {
        let conn = open_memory().unwrap();
        let owner = add_user(&conn, None, "Owner Test", "owner", &[], PW).unwrap();
        (conn, owner)
    }

    #[test]
    fn first_user_must_be_owner() {
        let conn = open_memory().unwrap();
        assert!(add_user(&conn, None, "Staff", "staff", &[], PW).is_err());
        assert!(needs_setup(&conn));
    }

    #[test]
    fn only_owner_adds_staff() {
        let (conn, owner) = setup();
        let staff = add_user(&conn, Some(&owner), "Staff Test", "staff", &["FB".into()], PW).unwrap();
        assert_eq!(staff.businesses, vec!["FB".to_string()]);
        assert!(add_user(&conn, Some(&staff), "Third", "staff", &[], PW).is_err());
        assert!(add_user(&conn, None, "Fourth", "staff", &[], PW).is_err());
    }

    #[test]
    fn password_is_hashed_and_short_ones_refused() {
        let (conn, owner) = setup();
        let stored: String = conn.query_row("SELECT password_hash FROM users WHERE id = ?1", params![owner.id], |r| r.get(0)).unwrap();
        assert!(stored.starts_with("$argon2") && !stored.contains(PW));
        assert!(set_password(&conn, &owner.id, "short").is_err());
    }

    #[test]
    fn locks_after_five_wrong_tries() {
        let (conn, owner) = setup();
        for _ in 0..5 {
            assert!(sign_in(&conn, &owner.id, "wrong-password", 1000).is_err());
        }
        let err = sign_in(&conn, &owner.id, PW, 1001).unwrap_err();
        assert!(err.contains("Too many"));
        assert!(sign_in(&conn, &owner.id, PW, 1000 + LOCK_SECONDS + 1).is_ok());
    }

    #[test]
    fn session_ends_after_idle() {
        let (conn, owner) = setup();
        sign_in(&conn, &owner.id, PW, 1000).unwrap();
        assert!(current(&conn, 1000 + 60).unwrap().is_some());
        assert!(current(&conn, 1060 + IDLE_SECONDS + 1).unwrap().is_none());
    }

    #[test]
    fn inactive_user_cannot_sign_in() {
        let (conn, owner) = setup();
        let staff = add_user(&conn, Some(&owner), "Staff Test", "staff", &[], PW).unwrap();
        set_active(&conn, &owner, &staff.id, false).unwrap();
        assert!(sign_in(&conn, &staff.id, PW, 1000).is_err());
    }
}
