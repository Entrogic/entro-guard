use std::fmt;
use std::fmt::{Display, Formatter};

use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Timelike, Utc, Weekday};
use chrono_tz::Tz;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimeError {
    message: String,
}

impl Display for TimeError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for TimeError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ClockTime {
    pub hour: u32,
    pub minute: u32,
}

impl ClockTime {
    pub fn parse(input: &str) -> Result<Self, TimeError> {
        let bytes = input.as_bytes();
        if bytes.len() != 5 || bytes[2] != b':' {
            return Err(TimeError {
                message: format!("invalid time '{input}', expected HH:MM"),
            });
        }
        let hour: u32 = input[0..2].parse().map_err(|_| TimeError {
            message: format!("invalid hour in '{input}'"),
        })?;
        let minute: u32 = input[3..5].parse().map_err(|_| TimeError {
            message: format!("invalid minute in '{input}'"),
        })?;
        if hour > 23 || minute > 59 {
            return Err(TimeError {
                message: format!("time out of range: {input}"),
            });
        }
        Ok(Self { hour, minute })
    }

    pub fn to_minutes(self) -> u32 {
        self.hour * 60 + self.minute
    }
}

impl Display for ClockTime {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:02}:{:02}", self.hour, self.minute)
    }
}

impl Serialize for ClockTime {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for ClockTime {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        ClockTime::parse(&raw).map_err(serde::de::Error::custom)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Bedtime {
    pub start: ClockTime,
    pub end: ClockTime,
}

impl Bedtime {
    pub fn overnight(self) -> bool {
        self.end < self.start
    }

    pub fn contains(self, t: ClockTime) -> bool {
        if self.overnight() {
            t >= self.start || t < self.end
        } else {
            t >= self.start && t < self.end
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DayOfWeek {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl DayOfWeek {
    pub fn previous(self) -> Self {
        match self {
            Self::Mon => Self::Sun,
            Self::Tue => Self::Mon,
            Self::Wed => Self::Tue,
            Self::Thu => Self::Wed,
            Self::Fri => Self::Thu,
            Self::Sat => Self::Fri,
            Self::Sun => Self::Sat,
        }
    }

    pub fn is_weekend(self) -> bool {
        matches!(self, Self::Sat | Self::Sun)
    }

    pub fn to_chrono(self) -> Weekday {
        match self {
            Self::Mon => Weekday::Mon,
            Self::Tue => Weekday::Tue,
            Self::Wed => Weekday::Wed,
            Self::Thu => Weekday::Thu,
            Self::Fri => Weekday::Fri,
            Self::Sat => Weekday::Sat,
            Self::Sun => Weekday::Sun,
        }
    }

    pub fn from_chrono(w: Weekday) -> Self {
        match w {
            Weekday::Mon => Self::Mon,
            Weekday::Tue => Self::Tue,
            Weekday::Wed => Self::Wed,
            Weekday::Thu => Self::Thu,
            Weekday::Fri => Self::Fri,
            Weekday::Sat => Self::Sat,
            Weekday::Sun => Self::Sun,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NamedDays {
    Weekdays,
    Weekend,
    All,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(untagged)]
pub enum Days {
    Named(NamedDays),
    List(Vec<DayOfWeek>),
}

impl Days {
    pub fn contains(&self, day: DayOfWeek) -> bool {
        match self {
            Self::Named(NamedDays::All) => true,
            Self::Named(NamedDays::Weekdays) => !day.is_weekend(),
            Self::Named(NamedDays::Weekend) => day.is_weekend(),
            Self::List(list) => list.contains(&day),
        }
    }

    pub fn is_empty(&self) -> bool {
        matches!(self, Self::List(list) if list.is_empty())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct AllowedWindow {
    pub days: Days,
    pub start: ClockTime,
    pub end: ClockTime,
}

impl AllowedWindow {
    fn overnight(&self) -> bool {
        self.end < self.start
    }

    pub fn contains(&self, day: DayOfWeek, t: ClockTime) -> bool {
        if self.overnight() {
            (self.days.contains(day) && t >= self.start)
                || (self.days.contains(day.previous()) && t < self.end)
        } else {
            self.days.contains(day) && t >= self.start && t < self.end
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct TimePolicy {
    pub bedtime: Option<Bedtime>,
    pub allowed_windows: Vec<AllowedWindow>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScheduleState {
    Allowed,
    Bedtime,
    OutsideAllowedWindow,
}

pub fn evaluate(policy: &TimePolicy, now: DateTime<Utc>, tz: Tz) -> ScheduleState {
    let local = now.with_timezone(&tz);
    let t = ClockTime {
        hour: local.hour(),
        minute: local.minute(),
    };
    let day = DayOfWeek::from_chrono(local.weekday());

    if let Some(bedtime) = policy.bedtime
        && bedtime.contains(t)
    {
        return ScheduleState::Bedtime;
    }

    if !policy.allowed_windows.is_empty()
        && !policy.allowed_windows.iter().any(|w| w.contains(day, t))
    {
        return ScheduleState::OutsideAllowedWindow;
    }

    ScheduleState::Allowed
}

pub fn next_transition(policy: &TimePolicy, now: DateTime<Utc>, tz: Tz) -> Option<DateTime<Utc>> {
    let local = now.with_timezone(&tz);
    let today = local.date_naive();
    let mut candidates: Vec<DateTime<Utc>> = Vec::new();

    if let Some(bedtime) = policy.bedtime {
        for day_offset in 0..=1 {
            let date = today + chrono::Duration::days(day_offset);
            for time in [bedtime.start, bedtime.end] {
                if let Some(dt) = at_local(tz, date, time) {
                    candidates.push(dt);
                }
            }
        }
    }

    for window in &policy.allowed_windows {
        for day_offset in 0..=7 {
            let date = today + chrono::Duration::days(day_offset);
            let day = DayOfWeek::from_chrono(date.weekday());
            if window.days.contains(day) {
                for time in [window.start, window.end] {
                    if let Some(dt) = at_local(tz, date, time) {
                        candidates.push(dt);
                    }
                }
            }
        }
    }

    candidates.into_iter().filter(|dt| dt > &now).min()
}

fn at_local(tz: Tz, date: NaiveDate, time: ClockTime) -> Option<DateTime<Utc>> {
    tz.with_ymd_and_hms(
        date.year(),
        date.month(),
        date.day(),
        time.hour,
        time.minute,
        0,
    )
    .single()
    .map(|dt| dt.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn utc(s: &str) -> DateTime<Utc> {
        s.parse().unwrap()
    }

    #[test]
    fn parses_clock_times() {
        assert_eq!(
            ClockTime::parse("07:00").unwrap(),
            ClockTime { hour: 7, minute: 0 }
        );
        assert_eq!(
            ClockTime::parse("23:59").unwrap(),
            ClockTime {
                hour: 23,
                minute: 59
            }
        );
        assert!(ClockTime::parse("7:00").is_err());
        assert!(ClockTime::parse("24:00").is_err());
        assert!(ClockTime::parse("23:60").is_err());
        assert!(ClockTime::parse("").is_err());
    }

    #[test]
    fn bedtime_overnight_boundaries() {
        let bedtime = Bedtime {
            start: ClockTime::parse("21:00").unwrap(),
            end: ClockTime::parse("07:00").unwrap(),
        };
        assert!(bedtime.contains(ClockTime::parse("21:00").unwrap()));
        assert!(bedtime.contains(ClockTime::parse("22:30").unwrap()));
        assert!(bedtime.contains(ClockTime::parse("06:59").unwrap()));
        assert!(!bedtime.contains(ClockTime::parse("07:00").unwrap()));
        assert!(!bedtime.contains(ClockTime::parse("12:00").unwrap()));
        assert!(!bedtime.contains(ClockTime::parse("20:59").unwrap()));
    }

    #[test]
    fn bedtime_within_same_day() {
        let bedtime = Bedtime {
            start: ClockTime::parse("08:00").unwrap(),
            end: ClockTime::parse("10:00").unwrap(),
        };
        assert!(bedtime.contains(ClockTime::parse("08:00").unwrap()));
        assert!(!bedtime.contains(ClockTime::parse("10:00").unwrap()));
        assert!(!bedtime.contains(ClockTime::parse("07:59").unwrap()));
    }

    #[test]
    fn weekday_window_allows_monday_but_not_sunday() {
        let policy = TimePolicy {
            bedtime: None,
            allowed_windows: vec![AllowedWindow {
                days: Days::Named(NamedDays::Weekdays),
                start: ClockTime::parse("06:00").unwrap(),
                end: ClockTime::parse("21:00").unwrap(),
            }],
        };
        let tz: Tz = "Asia/Dhaka".parse().unwrap();
        let monday = utc("2026-10-26T10:00:00Z");
        assert_eq!(evaluate(&policy, monday, tz), ScheduleState::Allowed);
        let sunday = utc("2026-10-25T10:00:00Z");
        assert_eq!(
            evaluate(&policy, sunday, tz),
            ScheduleState::OutsideAllowedWindow
        );
    }

    #[test]
    fn bedtime_decisions_depend_on_timezone() {
        let bedtime = Bedtime {
            start: ClockTime::parse("21:00").unwrap(),
            end: ClockTime::parse("07:00").unwrap(),
        };
        let policy = TimePolicy {
            bedtime: Some(bedtime),
            allowed_windows: vec![],
        };
        let now = utc("2026-10-26T02:30:00Z");

        let dhaka: Tz = "Asia/Dhaka".parse().unwrap();
        assert_eq!(evaluate(&policy, now, dhaka), ScheduleState::Allowed);

        let new_york: Tz = "America/New_York".parse().unwrap();
        assert_eq!(evaluate(&policy, now, new_york), ScheduleState::Bedtime);
    }

    #[test]
    fn next_transition_finds_bedtime_end() {
        let bedtime = Bedtime {
            start: ClockTime::parse("21:00").unwrap(),
            end: ClockTime::parse("07:00").unwrap(),
        };
        let policy = TimePolicy {
            bedtime: Some(bedtime),
            allowed_windows: vec![],
        };
        let tz: Tz = "Asia/Dhaka".parse().unwrap();
        let now = utc("2026-10-26T16:00:00Z");
        let next = next_transition(&policy, now, tz).unwrap();
        assert_eq!(
            next,
            tz.with_ymd_and_hms(2026, 10, 27, 7, 0, 0)
                .unwrap()
                .with_timezone(&Utc)
        );
    }
}
