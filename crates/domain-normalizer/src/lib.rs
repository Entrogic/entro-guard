use std::fmt;
use std::fmt::{Display, Formatter};

use url::Host;

const MAX_DOMAIN_LENGTH: usize = 253;
const MAX_LABEL_LENGTH: usize = 63;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizeError {
    message: String,
}

impl NormalizeError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl Display for NormalizeError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for NormalizeError {}

pub fn normalize_domain(input: &str) -> Result<String, NormalizeError> {
    let raw = input.trim();
    if raw.is_empty() {
        return Err(NormalizeError::new("empty input"));
    }

    let candidate = if raw.contains("://") {
        let parsed =
            url::Url::parse(raw).map_err(|e| NormalizeError::new(format!("invalid url: {e}")))?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err(NormalizeError::new(format!(
                "unsupported scheme: {}",
                parsed.scheme()
            )));
        }
        match parsed.host() {
            Some(Host::Domain(d)) => d.to_string(),
            Some(_) => return Err(NormalizeError::new("ip addresses are not supported")),
            None => return Err(NormalizeError::new("url has no host")),
        }
    } else {
        if raw
            .chars()
            .any(|c| matches!(c, '/' | '?' | '#' | ':' | '@' | '\\') || c.is_whitespace())
        {
            return Err(NormalizeError::new("invalid characters in domain"));
        }
        raw.to_string()
    };

    let host = candidate.trim_end_matches('.');
    if host.is_empty() {
        return Err(NormalizeError::new("empty host"));
    }

    let parsed =
        Host::parse(host).map_err(|e| NormalizeError::new(format!("invalid host: {e}")))?;
    let domain = match parsed {
        Host::Domain(d) => d,
        _ => return Err(NormalizeError::new("ip addresses are not supported")),
    };

    validate_labels(&domain)?;
    Ok(domain)
}

fn validate_labels(domain: &str) -> Result<(), NormalizeError> {
    if domain.len() > MAX_DOMAIN_LENGTH {
        return Err(NormalizeError::new("domain too long"));
    }
    for label in domain.split('.') {
        if label.is_empty() {
            return Err(NormalizeError::new("empty label"));
        }
        if label.len() > MAX_LABEL_LENGTH {
            return Err(NormalizeError::new("label too long"));
        }
        if label.starts_with('-') || label.ends_with('-') {
            return Err(NormalizeError::new("label starts or ends with a hyphen"));
        }
        if !label
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        {
            return Err(NormalizeError::new("label contains invalid characters"));
        }
    }
    Ok(())
}

pub fn is_subdomain_of(hostname: &str, base: &str) -> bool {
    let host = hostname.trim_end_matches('.').to_ascii_lowercase();
    let base = base.trim_end_matches('.').to_ascii_lowercase();
    host == base || host.ends_with(&format!(".{base}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lowercases_input() {
        assert_eq!(normalize_domain("EXAMPLE.COM").unwrap(), "example.com");
    }

    #[test]
    fn applies_idna_to_unicode() {
        assert_eq!(
            normalize_domain("bücher.example").unwrap(),
            "xn--bcher-kva.example"
        );
    }

    #[test]
    fn extracts_host_from_url() {
        assert_eq!(
            normalize_domain("https://www.Example.com/path?q=1").unwrap(),
            "www.example.com"
        );
        assert_eq!(
            normalize_domain("http://sub.example.com").unwrap(),
            "sub.example.com"
        );
    }

    #[test]
    fn strips_trailing_dot() {
        assert_eq!(normalize_domain("example.com.").unwrap(), "example.com");
    }

    #[test]
    fn rejects_invalid_domains() {
        assert!(normalize_domain("").is_err());
        assert!(normalize_domain("exa mple.com").is_err());
        assert!(normalize_domain("-bad.example").is_err());
        assert!(normalize_domain("bad-.example").is_err());
        assert!(normalize_domain("example.com/path").is_err());
        assert!(normalize_domain("example.com:8080").is_err());
        assert!(normalize_domain("http://").is_err());
        assert!(normalize_domain("ftp://example.com").is_err());
        assert!(normalize_domain("127.0.0.1").is_err());
        assert!(normalize_domain("https://10.0.0.1").is_err());
    }

    #[test]
    fn enforces_hostname_boundaries() {
        assert!(!is_subdomain_of("notexample.com", "example.com"));
        assert!(!is_subdomain_of("badexample.com", "example.com"));
        assert!(is_subdomain_of("example.com", "example.com"));
        assert!(is_subdomain_of("sub.example.com", "example.com"));
        assert!(is_subdomain_of("a.b.example.com", "example.com"));
    }
}
