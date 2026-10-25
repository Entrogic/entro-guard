use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use policy_schema::{
    AppAction, AppRule, ContentCategory, Policy, PolicyParseError, TemporaryGrant, WebsiteAction,
};
use time_policy::{Bedtime, ScheduleState, TimePolicy};

pub trait CategoryClassifier: Send + Sync {
    fn classify(&self, normalized_domain: &str) -> Option<ContentCategory>;
}

#[derive(Default)]
pub struct NoCategoryClassifier;

impl CategoryClassifier for NoCategoryClassifier {
    fn classify(&self, _normalized_domain: &str) -> Option<ContentCategory> {
        None
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WebsiteReason {
    TemporaryException(DateTime<Utc>),
    ExplicitAllow,
    ExplicitBlock,
    CategoryBlock(ContentCategory),
    Default,
    PolicyExpired,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WebsiteDecision {
    pub action: WebsiteAction,
    pub reason: WebsiteReason,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AppReason {
    ExplicitRule,
    DefaultAllow,
    PolicyExpired,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AppDecision {
    pub action: AppAction,
    pub reason: AppReason,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScreenTimeState {
    Allowed,
    Bedtime,
    OutsideAllowedWindow,
    DailyLimitExceeded,
    PolicyExpired,
}

pub struct PolicyEngine {
    classifier: Box<dyn CategoryClassifier>,
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new(NoCategoryClassifier)
    }
}

impl PolicyEngine {
    pub fn new(classifier: impl CategoryClassifier + 'static) -> Self {
        Self {
            classifier: Box::new(classifier),
        }
    }

    pub fn evaluate_website(
        &self,
        policy: &Policy,
        hostname: &str,
        now: DateTime<Utc>,
        grants: &[TemporaryGrant],
    ) -> WebsiteDecision {
        if policy_expired(policy, now) {
            return WebsiteDecision {
                action: WebsiteAction::Block,
                reason: WebsiteReason::PolicyExpired,
            };
        }

        let normalized = domain_normalizer::normalize_domain(hostname).unwrap_or_default();

        for grant in grants {
            if grant.expires_at > now
                && domain_normalizer::is_subdomain_of(&normalized, &grant.resource_identifier)
            {
                return WebsiteDecision {
                    action: WebsiteAction::Allow,
                    reason: WebsiteReason::TemporaryException(grant.expires_at),
                };
            }
        }

        if policy
            .website
            .allowed_domains
            .iter()
            .any(|d| domain_normalizer::is_subdomain_of(&normalized, d))
        {
            return WebsiteDecision {
                action: WebsiteAction::Allow,
                reason: WebsiteReason::ExplicitAllow,
            };
        }

        if policy
            .website
            .blocked_domains
            .iter()
            .any(|d| domain_normalizer::is_subdomain_of(&normalized, d))
        {
            return WebsiteDecision {
                action: WebsiteAction::Block,
                reason: WebsiteReason::ExplicitBlock,
            };
        }

        if let Some(category) = self.classifier.classify(&normalized)
            && policy.website.categories_blocked.contains(&category)
        {
            return WebsiteDecision {
                action: WebsiteAction::Block,
                reason: WebsiteReason::CategoryBlock(category),
            };
        }

        WebsiteDecision {
            action: policy.website.default_action,
            reason: WebsiteReason::Default,
        }
    }

    pub fn evaluate_app(&self, policy: &Policy, app_id: &str, now: DateTime<Utc>) -> AppDecision {
        if policy_expired(policy, now) {
            return AppDecision {
                action: AppAction::Allow,
                reason: AppReason::PolicyExpired,
            };
        }
        if let Some(rule) = find_app_rule(&policy.apps.rules, app_id) {
            return AppDecision {
                action: rule.action,
                reason: AppReason::ExplicitRule,
            };
        }
        AppDecision {
            action: AppAction::Allow,
            reason: AppReason::DefaultAllow,
        }
    }

    pub fn evaluate_screen_time(
        &self,
        policy: &Policy,
        now: DateTime<Utc>,
        used_minutes_today: u64,
    ) -> ScreenTimeState {
        if policy_expired(policy, now) {
            return ScreenTimeState::PolicyExpired;
        }

        let limit = policy.screen_time.daily_limit_minutes;
        if limit > 0 && used_minutes_today >= limit {
            return ScreenTimeState::DailyLimitExceeded;
        }

        let tz: Tz = policy.timezone.parse().unwrap_or(Tz::UTC);
        let time_policy = TimePolicy {
            bedtime: policy
                .screen_time
                .bedtime
                .as_ref()
                .filter(|b| b.enabled)
                .map(|b| Bedtime {
                    start: b.start,
                    end: b.end,
                }),
            allowed_windows: policy.screen_time.allowed_windows.clone(),
        };

        match time_policy::evaluate(&time_policy, now, tz) {
            ScheduleState::Allowed => ScreenTimeState::Allowed,
            ScheduleState::Bedtime => ScreenTimeState::Bedtime,
            ScheduleState::OutsideAllowedWindow => ScreenTimeState::OutsideAllowedWindow,
        }
    }

    pub fn screen_time_next_change(
        &self,
        policy: &Policy,
        now: DateTime<Utc>,
    ) -> Option<DateTime<Utc>> {
        let tz: Tz = policy.timezone.parse().unwrap_or(Tz::UTC);
        let time_policy = TimePolicy {
            bedtime: policy
                .screen_time
                .bedtime
                .as_ref()
                .filter(|b| b.enabled)
                .map(|b| Bedtime {
                    start: b.start,
                    end: b.end,
                }),
            allowed_windows: policy.screen_time.allowed_windows.clone(),
        };
        time_policy::next_transition(&time_policy, now, tz)
    }
}

pub fn policy_expired(policy: &Policy, now: DateTime<Utc>) -> bool {
    policy.expires_at.is_some_and(|expires| now >= expires)
}

fn find_app_rule<'a>(rules: &'a [AppRule], app_id: &str) -> Option<&'a AppRule> {
    rules.iter().find(|r| r.app_id == app_id)
}

#[derive(Default)]
pub struct PolicyCache {
    current: Option<Policy>,
}

impl PolicyCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn current(&self) -> Option<&Policy> {
        self.current.as_ref()
    }

    pub fn ingest(&mut self, json: &str) -> Result<(), PolicyParseError> {
        match policy_schema::parse_policy(json) {
            Ok(policy) => {
                self.current = Some(policy);
                Ok(())
            }
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    const POLICY_JSON: &str = r#"{
        "schema_version": 1,
        "policy_id": "policy-test",
        "version": 1,
        "timezone": "Asia/Dhaka",
        "website": {
            "default_action": "allow",
            "blocked_domains": ["blocked.test"],
            "allowed_domains": ["allowed.test"],
            "categories_blocked": ["adult", "malware", "phishing"]
        },
        "screen_time": {
            "daily_limit_minutes": 120,
            "bedtime": { "enabled": true, "start": "21:00", "end": "07:00" },
            "allowed_windows": [
                { "days": "weekdays", "start": "06:00", "end": "21:00" }
            ]
        },
        "apps": {
            "rules": [{ "app_id": "com.blocked.app", "action": "block" }],
            "unsupported_behavior": "report_only"
        }
    }"#;

    struct TestClassifier;

    impl CategoryClassifier for TestClassifier {
        fn classify(&self, domain: &str) -> Option<ContentCategory> {
            match domain {
                "adult.test" => Some(ContentCategory::Adult),
                "malware.test" => Some(ContentCategory::Malware),
                "phishing.test" => Some(ContentCategory::Phishing),
                _ => None,
            }
        }
    }

    fn test_policy() -> Policy {
        policy_schema::parse_policy(POLICY_JSON).unwrap()
    }

    fn engine() -> PolicyEngine {
        PolicyEngine::new(TestClassifier)
    }

    fn now() -> DateTime<Utc> {
        "2026-10-26T12:00:00Z".parse().unwrap()
    }

    fn grant(resource: &str, expires: DateTime<Utc>) -> TemporaryGrant {
        TemporaryGrant {
            resource_identifier: resource.to_string(),
            expires_at: expires,
        }
    }

    #[test]
    fn default_action_applies_when_no_rule_matches() {
        let decision = engine().evaluate_website(&test_policy(), "clean.test", now(), &[]);
        assert_eq!(decision.action, WebsiteAction::Allow);
        assert_eq!(decision.reason, WebsiteReason::Default);
    }

    #[test]
    fn explicit_block_matches_subdomains_but_not_lookalikes() {
        let e = engine();
        let policy = test_policy();
        assert_eq!(
            e.evaluate_website(&policy, "sub.blocked.test", now(), &[])
                .reason,
            WebsiteReason::ExplicitBlock
        );
        assert_eq!(
            e.evaluate_website(&policy, "notblocked.test", now(), &[])
                .reason,
            WebsiteReason::Default
        );
    }

    #[test]
    fn allowlist_takes_precedence_over_blocklist() {
        let policy = test_policy();
        let decision = engine().evaluate_website(&policy, "allowed.test", now(), &[]);
        assert_eq!(decision.reason, WebsiteReason::ExplicitAllow);
    }

    #[test]
    fn temporary_exception_takes_precedence_over_everything() {
        let policy = test_policy();
        let expires = now() + Duration::hours(1);
        let decision = engine().evaluate_website(
            &policy,
            "blocked.test",
            now(),
            &[grant("blocked.test", expires)],
        );
        assert_eq!(decision.action, WebsiteAction::Allow);
        assert_eq!(decision.reason, WebsiteReason::TemporaryException(expires));
    }

    #[test]
    fn expired_exceptions_are_ignored() {
        let policy = test_policy();
        let decision = engine().evaluate_website(
            &policy,
            "blocked.test",
            now(),
            &[grant("blocked.test", now() - Duration::seconds(1))],
        );
        assert_eq!(decision.reason, WebsiteReason::ExplicitBlock);
    }

    #[test]
    fn exceptions_do_not_apply_to_other_resources() {
        let policy = test_policy();
        let decision = engine().evaluate_website(
            &policy,
            "blocked.test",
            now(),
            &[grant("unrelated.test", now() + Duration::hours(1))],
        );
        assert_eq!(decision.reason, WebsiteReason::ExplicitBlock);
    }

    #[test]
    fn category_block_applies_without_explicit_rule() {
        let decision = engine().evaluate_website(&test_policy(), "adult.test", now(), &[]);
        assert_eq!(decision.action, WebsiteAction::Block);
        assert_eq!(
            decision.reason,
            WebsiteReason::CategoryBlock(ContentCategory::Adult)
        );
    }

    #[test]
    fn category_block_does_not_fire_for_unblocked_category() {
        let policy = test_policy();
        let mut p = policy.clone();
        p.website.categories_blocked = vec![ContentCategory::Adult];
        let decision = engine().evaluate_website(&p, "malware.test", now(), &[]);
        assert_eq!(decision.reason, WebsiteReason::Default);
    }

    #[test]
    fn expired_policy_blocks_websites() {
        let mut policy = test_policy();
        policy.expires_at = Some(now() - Duration::seconds(1));
        let decision = engine().evaluate_website(&policy, "clean.test", now(), &[]);
        assert_eq!(decision.action, WebsiteAction::Block);
        assert_eq!(decision.reason, WebsiteReason::PolicyExpired);
    }

    #[test]
    fn screen_time_respects_bedtime_in_policy_timezone() {
        let policy = test_policy();
        let e = engine();
        let during_bedtime: DateTime<Utc> = "2026-10-26T16:00:00Z".parse().unwrap();
        assert_eq!(
            e.evaluate_screen_time(&policy, during_bedtime, 10),
            ScreenTimeState::Bedtime
        );
        let morning: DateTime<Utc> = "2026-10-27T03:00:00Z".parse().unwrap();
        assert_eq!(
            e.evaluate_screen_time(&policy, morning, 10),
            ScreenTimeState::Allowed
        );
    }

    #[test]
    fn screen_time_enforces_daily_limit() {
        let policy = test_policy();
        let e = engine();
        let noon: DateTime<Utc> = "2026-10-26T06:00:00Z".parse().unwrap();
        assert_eq!(
            e.evaluate_screen_time(&policy, noon, 119),
            ScreenTimeState::Allowed
        );
        assert_eq!(
            e.evaluate_screen_time(&policy, noon, 120),
            ScreenTimeState::DailyLimitExceeded
        );
    }

    #[test]
    fn screen_time_enforces_allowed_windows() {
        let policy = test_policy();
        let e = engine();
        let sunday: DateTime<Utc> = "2026-10-25T10:00:00Z".parse().unwrap();
        assert_eq!(
            e.evaluate_screen_time(&policy, sunday, 0),
            ScreenTimeState::OutsideAllowedWindow
        );
    }

    #[test]
    fn app_rules_apply_to_matching_ids() {
        let policy = test_policy();
        let e = engine();
        let decision = e.evaluate_app(&policy, "com.blocked.app", now());
        assert_eq!(decision.action, AppAction::Block);
        assert_eq!(decision.reason, AppReason::ExplicitRule);

        let decision = e.evaluate_app(&policy, "com.other.app", now());
        assert_eq!(decision.action, AppAction::Allow);
        assert_eq!(decision.reason, AppReason::DefaultAllow);
    }

    #[test]
    fn cache_keeps_previous_policy_on_invalid_ingest() {
        let mut cache = PolicyCache::new();
        assert!(cache.ingest(POLICY_JSON).is_ok());
        assert_eq!(cache.current().unwrap().policy_id, "policy-test");

        assert!(cache.ingest("{ not valid").is_err());
        assert_eq!(cache.current().unwrap().policy_id, "policy-test");

        let replaced = POLICY_JSON.replace("policy-test", "policy-test-2");
        assert!(cache.ingest(&replaced).is_ok());
        assert_eq!(cache.current().unwrap().policy_id, "policy-test-2");
    }

    #[test]
    fn cache_rejects_invalid_policy_json() {
        let mut cache = PolicyCache::new();
        let bad = POLICY_JSON.replace("\"version\": 1", "\"version\": 0");
        assert!(cache.ingest(&bad).is_err());
        assert!(cache.current().is_none());
    }
}
