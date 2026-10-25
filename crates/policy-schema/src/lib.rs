use std::fmt;
use std::fmt::{Display, Formatter};
use std::str::FromStr;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use time_policy::{AllowedWindow, ClockTime, Days};

pub const SCHEMA_VERSION: u32 = 1;
pub const MAX_DAILY_LIMIT_MINUTES: u64 = 1440;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WebsiteAction {
    Allow,
    Block,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ContentCategory {
    Adult,
    Malware,
    Phishing,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AppAction {
    Allow,
    Block,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UnsupportedBehavior {
    ReportOnly,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct WebsitePolicy {
    pub default_action: WebsiteAction,
    #[serde(default)]
    pub blocked_domains: Vec<String>,
    #[serde(default)]
    pub allowed_domains: Vec<String>,
    #[serde(default)]
    pub categories_blocked: Vec<ContentCategory>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct BedtimeConfig {
    pub enabled: bool,
    pub start: ClockTime,
    pub end: ClockTime,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct ScreenTimePolicy {
    pub daily_limit_minutes: u64,
    #[serde(default)]
    pub bedtime: Option<BedtimeConfig>,
    #[serde(default)]
    pub allowed_windows: Vec<AllowedWindow>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct AppRule {
    pub app_id: String,
    pub action: AppAction,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct AppsPolicy {
    #[serde(default)]
    pub rules: Vec<AppRule>,
    pub unsupported_behavior: UnsupportedBehavior,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct Policy {
    pub schema_version: u32,
    pub policy_id: String,
    pub version: u64,
    pub timezone: String,
    pub website: WebsitePolicy,
    pub screen_time: ScreenTimePolicy,
    pub apps: AppsPolicy,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct TemporaryGrant {
    pub resource_identifier: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    UnsupportedSchemaVersion(u32),
    InvalidVersion(u64),
    EmptyPolicyId,
    InvalidTimezone(String),
    InvalidDomain { field: &'static str, input: String },
    DuplicateDomain { field: &'static str, domain: String },
    DuplicateCategory(ContentCategory),
    InvalidDailyLimit(u64),
    BedtimeStartEqualsEnd,
    WindowStartEqualsEnd,
    EmptyWindowDays,
    EmptyAppId,
    DuplicateAppRule(String),
    InvalidGrantResource(String),
}

impl Display for ValidationError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedSchemaVersion(v) => {
                write!(
                    f,
                    "unsupported schema version {v}, expected {SCHEMA_VERSION}"
                )
            }
            Self::InvalidVersion(v) => write!(f, "invalid policy version {v}"),
            Self::EmptyPolicyId => write!(f, "policy_id must not be empty"),
            Self::InvalidTimezone(tz) => write!(f, "invalid IANA timezone: {tz}"),
            Self::InvalidDomain { field, input } => {
                write!(f, "invalid domain in {field}: {input}")
            }
            Self::DuplicateDomain { field, domain } => {
                write!(f, "duplicate domain in {field}: {domain}")
            }
            Self::DuplicateCategory(c) => write!(f, "duplicate category: {c:?}"),
            Self::InvalidDailyLimit(v) => {
                write!(
                    f,
                    "daily_limit_minutes {v} exceeds {MAX_DAILY_LIMIT_MINUTES}"
                )
            }
            Self::BedtimeStartEqualsEnd => write!(f, "bedtime start and end must differ"),
            Self::WindowStartEqualsEnd => write!(f, "window start and end must differ"),
            Self::EmptyWindowDays => write!(f, "window days list must not be empty"),
            Self::EmptyAppId => write!(f, "app rule app_id must not be empty"),
            Self::DuplicateAppRule(id) => write!(f, "duplicate app rule: {id}"),
            Self::InvalidGrantResource(r) => write!(f, "invalid grant resource: {r}"),
        }
    }
}

impl std::error::Error for ValidationError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyParseError {
    Json(String),
    Invalid(ValidationError),
}

impl Display for PolicyParseError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Json(e) => write!(f, "policy json error: {e}"),
            Self::Invalid(e) => write!(f, "policy validation error: {e}"),
        }
    }
}

impl std::error::Error for PolicyParseError {}

pub fn parse_policy(json: &str) -> Result<Policy, PolicyParseError> {
    let policy: Policy =
        serde_json::from_str(json).map_err(|e| PolicyParseError::Json(e.to_string()))?;
    policy.validate().map_err(PolicyParseError::Invalid)?;
    Ok(policy)
}

impl Policy {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.schema_version != SCHEMA_VERSION {
            return Err(ValidationError::UnsupportedSchemaVersion(
                self.schema_version,
            ));
        }
        if self.version == 0 {
            return Err(ValidationError::InvalidVersion(self.version));
        }
        if self.policy_id.trim().is_empty() {
            return Err(ValidationError::EmptyPolicyId);
        }
        if Tz::from_str(&self.timezone).is_err() {
            return Err(ValidationError::InvalidTimezone(self.timezone.clone()));
        }

        validate_domain_list("blocked_domains", &self.website.blocked_domains)?;
        validate_domain_list("allowed_domains", &self.website.allowed_domains)?;

        for category in &self.website.categories_blocked {
            let count = self
                .website
                .categories_blocked
                .iter()
                .filter(|c| c == &category)
                .count();
            if count > 1 {
                return Err(ValidationError::DuplicateCategory(*category));
            }
        }

        if self.screen_time.daily_limit_minutes > MAX_DAILY_LIMIT_MINUTES {
            return Err(ValidationError::InvalidDailyLimit(
                self.screen_time.daily_limit_minutes,
            ));
        }

        if let Some(bedtime) = &self.screen_time.bedtime
            && bedtime.enabled
            && bedtime.start == bedtime.end
        {
            return Err(ValidationError::BedtimeStartEqualsEnd);
        }

        for window in &self.screen_time.allowed_windows {
            if window.start == window.end {
                return Err(ValidationError::WindowStartEqualsEnd);
            }
            if matches!(&window.days, Days::List(list) if list.is_empty()) {
                return Err(ValidationError::EmptyWindowDays);
            }
        }

        for rule in &self.apps.rules {
            if rule.app_id.trim().is_empty() {
                return Err(ValidationError::EmptyAppId);
            }
            let count = self
                .apps
                .rules
                .iter()
                .filter(|r| r.app_id == rule.app_id)
                .count();
            if count > 1 {
                return Err(ValidationError::DuplicateAppRule(rule.app_id.clone()));
            }
        }

        Ok(())
    }
}

fn validate_domain_list(field: &'static str, domains: &[String]) -> Result<(), ValidationError> {
    for domain in domains {
        let normalized = domain_normalizer::normalize_domain(domain).map_err(|_| {
            ValidationError::InvalidDomain {
                field,
                input: domain.clone(),
            }
        })?;
        if normalized != *domain {
            return Err(ValidationError::InvalidDomain {
                field,
                input: domain.clone(),
            });
        }
        let count = domains.iter().filter(|d| d == &domain).count();
        if count > 1 {
            return Err(ValidationError::DuplicateDomain {
                field,
                domain: domain.clone(),
            });
        }
    }
    Ok(())
}

impl TemporaryGrant {
    pub fn validate(&self) -> Result<(), ValidationError> {
        domain_normalizer::normalize_domain(&self.resource_identifier)
            .map_err(|_| ValidationError::InvalidGrantResource(self.resource_identifier.clone()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_JSON: &str = r#"{
        "schema_version": 1,
        "policy_id": "policy-example",
        "version": 1,
        "timezone": "Asia/Dhaka",
        "website": {
            "default_action": "allow",
            "blocked_domains": ["example.test"],
            "allowed_domains": ["school.example"],
            "categories_blocked": ["adult", "malware", "phishing"]
        },
        "screen_time": {
            "daily_limit_minutes": 120,
            "bedtime": { "enabled": true, "start": "21:00", "end": "07:00" }
        },
        "apps": {
            "rules": [],
            "unsupported_behavior": "report_only"
        }
    }"#;

    #[test]
    fn accepts_spec_example() {
        assert!(parse_policy(VALID_JSON).is_ok());
    }

    #[test]
    fn rejects_unknown_schema_version() {
        let json = VALID_JSON.replace("\"schema_version\": 1", "\"schema_version\": 2");
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(
                ValidationError::UnsupportedSchemaVersion(2)
            ))
        ));
    }

    #[test]
    fn rejects_invalid_timezone() {
        let json = VALID_JSON.replace("Asia/Dhaka", "Not/AZone");
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(ValidationError::InvalidTimezone(
                _
            )))
        ));
    }

    #[test]
    fn rejects_invalid_domain() {
        let json = VALID_JSON.replace("example.test", "not a domain!");
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(ValidationError::InvalidDomain {
                field: "blocked_domains",
                ..
            }))
        ));
    }

    #[test]
    fn rejects_unknown_fields() {
        let json = VALID_JSON.replace("\"version\": 1,", "\"version\": 1, \"bogus\": true,");
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Json(_))
        ));
    }

    #[test]
    fn rejects_invalid_time_format() {
        let json = VALID_JSON.replace("\"21:00\"", "\"9:00\"");
        assert!(parse_policy(&json).is_err());
    }

    #[test]
    fn rejects_daily_limit_above_24h() {
        let json = VALID_JSON.replace(
            "\"daily_limit_minutes\": 120",
            "\"daily_limit_minutes\": 1441",
        );
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(
                ValidationError::InvalidDailyLimit(1441)
            ))
        ));
    }

    #[test]
    fn rejects_bedtime_with_equal_bounds() {
        let json = VALID_JSON.replace("\"end\": \"07:00\"", "\"end\": \"21:00\"");
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(
                ValidationError::BedtimeStartEqualsEnd
            ))
        ));
    }

    #[test]
    fn rejects_duplicate_app_rules() {
        let json = VALID_JSON.replace(
            "\"rules\": []",
            "\"rules\": [{\"app_id\": \"com.x\", \"action\": \"block\"}, {\"app_id\": \"com.x\", \"action\": \"allow\"}]",
        );
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(
                ValidationError::DuplicateAppRule(_)
            ))
        ));
    }

    #[test]
    fn rejects_invalid_unsupported_behavior() {
        let json = VALID_JSON.replace("report_only", "block_everything");
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Json(_))
        ));
    }

    #[test]
    fn rejects_invalid_grant_resource() {
        let grant = TemporaryGrant {
            resource_identifier: "not a domain!".to_string(),
            expires_at: Utc::now(),
        };
        assert!(matches!(
            grant.validate(),
            Err(ValidationError::InvalidGrantResource(_))
        ));
    }

    #[test]
    fn rejects_duplicate_domains() {
        let json = VALID_JSON.replace(
            "\"blocked_domains\": [\"example.test\"]",
            "\"blocked_domains\": [\"example.test\", \"example.test\"]",
        );
        assert!(matches!(
            parse_policy(&json),
            Err(PolicyParseError::Invalid(
                ValidationError::DuplicateDomain {
                    field: "blocked_domains",
                    ..
                }
            ))
        ));
    }
}
