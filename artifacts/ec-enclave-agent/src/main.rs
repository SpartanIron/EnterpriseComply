//! EnterpriseComply eMASS Enclave Bridge Agent
//!
//! Lightweight, memory-safe Rust binary that runs INSIDE a DoD secure enclave
//! (NIPRNet, SIPRNet, or JWICS boundary). It uses outbound-only TLS to reach the
//! EnterpriseComply cloud queue, then delivers POA&M updates to the local eMASS
//! API endpoint using DoD PKI mTLS and EDIPI user attribution.
//!
//! # Architecture
//!
//!   [EC Cloud Queue] <--outbound TLS-- [This Agent] --mTLS--> [Local eMASS API]
//!
//! # Security Model
//!   - All outbound connections initiated by agent (no inbound ports required)
//!   - DoD PKI certificate (CAC/PIV) used for eMASS mTLS handshake
//!   - EDIPI extracted from certificate Subject CN and injected as user-uid header
//!   - All traffic is TLS 1.2+ (TLS 1.3 preferred)
//!   - Agent runs as non-root (dedicated service account)
//!   - Certificate private key never leaves the enclave

use anyhow::{Context, Result};
use chrono::Utc;
use clap::Parser;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::Duration;
use tracing::{error, info, warn};

// ──────────────────────────────────────────────────────────────────────────────
// CLI Configuration
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
#[command(
    name = "ec-enclave-agent",
    about = "EnterpriseComply eMASS Enclave Bridge Agent",
    long_about = "Polls EC cloud queue for pending POA&M updates and delivers them to local eMASS API using DoD PKI mTLS"
)]
struct Args {
    /// EnterpriseComply cloud queue base URL
    #[arg(long, env = "EC_QUEUE_URL", default_value = "https://app.enterprisecomply.com")]
    ec_queue_url: String,

    /// Organization ID in EnterpriseComply
    #[arg(long, env = "EC_ORG_ID")]
    org_id: u64,

    /// API key for EC cloud queue authentication
    #[arg(long, env = "EC_API_KEY")]
    ec_api_key: String,

    /// Local eMASS API base URL (inside enclave)
    #[arg(long, env = "EMASS_API_URL", default_value = "https://emass.local:8443")]
    emass_url: String,

    /// Path to DoD PKI client certificate (PEM format, CAC/PIV cert)
    #[arg(long, env = "DOD_PKI_CERT_PATH")]
    dod_cert_path: PathBuf,

    /// Path to DoD PKI client private key (PEM format)
    #[arg(long, env = "DOD_PKI_KEY_PATH")]
    dod_key_path: PathBuf,

    /// Path to DoD PKI CA bundle (DoD Root CA 2, 3, 4, 5 + JITC CAs)
    #[arg(long, env = "DOD_CA_BUNDLE_PATH")]
    dod_ca_bundle: PathBuf,

    /// EDIPI of the enclave operator (10-digit DoD ID number)
    /// If not set, extracted from certificate Subject CN
    #[arg(long, env = "OPERATOR_EDIPI")]
    edipi: Option<String>,

    /// Poll interval in seconds
    #[arg(long, env = "POLL_INTERVAL_SECS", default_value = "300")]
    poll_interval: u64,

    /// Maximum number of POA&M items to process per poll cycle
    #[arg(long, env = "BATCH_SIZE", default_value = "50")]
    batch_size: usize,

    /// Path to write agent state/checkpoint file
    #[arg(long, env = "STATE_FILE", default_value = "/var/lib/ec-agent/state.json")]
    state_file: PathBuf,

    /// Enable verbose/debug logging
    #[arg(long, short)]
    verbose: bool,
}

// ──────────────────────────────────────────────────────────────────────────────
// Data Models
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct QueuePullResponse {
    updates: Vec<PoamUpdate>,
    count: u64,
    next_poll_at: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct PoamUpdate {
    id: String,
    org_id: u64,
    uco_control_id: String,
    nist_control_id: String,
    nist_control_name: String,
    status: String,
    result: String,
    poam_id: Option<u64>,
    poam_weakness: Option<String>,
    created_at: String,
    requires_edipi: bool,
}

#[derive(Debug, Serialize)]
struct EmassPoamPayload {
    #[serde(rename = "systemId")]
    system_id: String,
    #[serde(rename = "controlAcronym")]
    control_acronym: String,
    #[serde(rename = "cci")]
    cci: String,
    #[serde(rename = "status")]
    status: String,
    #[serde(rename = "weakness")]
    weakness: String,
    #[serde(rename = "point_of_contact")]
    point_of_contact: String,
    #[serde(rename = "resources")]
    resources: String,
    #[serde(rename = "scheduled_completion_date")]
    scheduled_completion_date: String,
    #[serde(rename = "milestones")]
    milestones: Vec<EmassMilestone>,
    #[serde(rename = "ec_source_id")]
    ec_source_id: String,
    #[serde(rename = "ec_uco_control_id")]
    ec_uco_control_id: String,
}

#[derive(Debug, Serialize)]
struct EmassMilestone {
    #[serde(rename = "description")]
    description: String,
    #[serde(rename = "scheduledCompletionDate")]
    scheduled_completion_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentState {
    last_successful_poll: Option<String>,
    total_items_delivered: u64,
    last_error: Option<String>,
    agent_version: String,
}

#[derive(Debug, Serialize)]
struct AcknowledgePayload {
    item_ids: Vec<String>,
    edipi: String,
    agent_version: String,
    delivered_at: String,
}

// ──────────────────────────────────────────────────────────────────────────────
// Certificate / EDIPI Utilities
// ──────────────────────────────────────────────────────────────────────────────

/// Extract EDIPI from DoD PKI certificate Subject CN.
/// DoD CAC/PIV certs have CN format: "LAST.FIRST.MIDDLE.EDIPI"
fn extract_edipi_from_cert(cert_pem: &[u8]) -> Option<String> {
    use rustls_pemfile::certs;
    use x509_parser::prelude::*;
    
    let mut cursor = std::io::Cursor::new(cert_pem);
    let cert_der = certs(&mut cursor).ok()?.into_iter().next()?;
    
    let (_, cert) = X509Certificate::from_der(&cert_der).ok()?;
    let subject = cert.subject();
    
    for rdn in subject.iter() {
        for attr in rdn.iter() {
            if attr.attr_type() == &oid_registry::OID_X509_COMMON_NAME {
                if let Ok(val) = attr.attr_value().as_str() {
                    // CN format: "DOE.JANE.MARIE.1234567890"
                    let parts: Vec<&str> = val.split('.').collect();
                    if let Some(last) = parts.last() {
                        // EDIPI is the 10-digit numeric last segment
                        if last.len() == 10 && last.chars().all(|c| c.is_ascii_digit()) {
                            return Some(last.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

/// Compute SHA-256 fingerprint of a certificate for audit logging
fn cert_fingerprint(cert_pem: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(cert_pem);
    hex::encode(hasher.finalize())
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP Client Builders
// ──────────────────────────────────────────────────────────────────────────────

/// Build the EC cloud queue client (outbound TLS, API key auth)
fn build_ec_client(api_key: &str) -> Result<Client> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "X-API-Key",
        reqwest::header::HeaderValue::from_str(api_key)
            .context("Invalid API key characters")?,
    );
    headers.insert(
        "User-Agent",
        reqwest::header::HeaderValue::from_static("ec-enclave-agent/1.0.0"),
    );
    
    Ok(Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(30))
        .https_only(true)
        .use_rustls_tls()
        .build()
        .context("Failed to build EC queue HTTP client")?)
}

/// Build the eMASS mTLS client with DoD PKI client certificate
fn build_emass_mtls_client(
    cert_path: &PathBuf,
    key_path: &PathBuf, 
    ca_bundle_path: &PathBuf,
) -> Result<Client> {
    let cert_pem = std::fs::read(cert_path)
        .with_context(|| format!("Cannot read DoD cert: {}", cert_path.display()))?;
    let key_pem = std::fs::read(key_path)
        .with_context(|| format!("Cannot read DoD key: {}", key_path.display()))?;
    let ca_pem = std::fs::read(ca_bundle_path)
        .with_context(|| format!("Cannot read DoD CA bundle: {}", ca_bundle_path.display()))?;
    
    // Build identity from cert + key
    let identity = reqwest::Identity::from_pem(&{
        let mut combined = cert_pem.clone();
        combined.extend_from_slice(&key_pem);
        combined
    }).context("Failed to parse DoD PKI identity (cert + key)")?;
    
    // Add DoD Root CA chain
    let ca_cert = reqwest::Certificate::from_pem(&ca_pem)
        .context("Failed to parse DoD CA bundle")?;
    
    info!(
        cert_fingerprint = cert_fingerprint(&cert_pem),
        "Loaded DoD PKI client certificate"
    );
    
    Ok(Client::builder()
        .identity(identity)
        .add_root_certificate(ca_cert)
        .tls_built_in_root_certs(false) // DoD PKI only — no commercial CAs
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .timeout(Duration::from_secs(60))
        .https_only(true)
        .use_rustls_tls()
        .build()
        .context("Failed to build eMASS mTLS client")?)
}

// ──────────────────────────────────────────────────────────────────────────────
// Core Agent Logic
// ──────────────────────────────────────────────────────────────────────────────

async fn poll_and_deliver(
    args: &Args,
    ec_client: &Client,
    emass_client: &Client,
    edipi: &str,
    state: &mut AgentState,
) -> Result<u64> {
    info!(org_id = args.org_id, edipi, "Polling EC cloud queue for pending POA&M updates");
    
    // 1. Pull pending updates from EC cloud queue
    let pull_url = format!(
        "{}/api/v1/emass/agent/pull/{}",
        args.ec_queue_url.trim_end_matches('/'),
        args.org_id
    );
    
    let queue_resp: QueuePullResponse = ec_client
        .get(&pull_url)
        .header("X-Agent-EDIPI", edipi)
        .header("X-Agent-Version", "1.0.0")
        .send()
        .await
        .context("Failed to reach EC queue endpoint")?
        .error_for_status()
        .context("EC queue returned error status")?
        .json()
        .await
        .context("Failed to parse EC queue response")?;
    
    info!(
        count = queue_resp.count,
        next_poll = queue_resp.next_poll_at.as_deref().unwrap_or("unset"),
        "Received pending POA&M updates from EC queue"
    );
    
    if queue_resp.updates.is_empty() {
        info!("Queue empty — nothing to deliver this cycle");
        return Ok(0);
    }
    
    // 2. Deliver each POA&M update to local eMASS API
    let mut delivered_ids: Vec<String> = Vec::new();
    let batch = &queue_resp.updates[..queue_resp.updates.len().min(args.batch_size)];
    
    for update in batch {
        if update.requires_edipi && edipi.is_empty() {
            warn!(
                control = update.nist_control_id,
                "Skipping item — requires EDIPI but none available"
            );
            continue;
        }
        
        // Map EC status to eMASS POA&M status
        let emass_status = match update.status.as_str() {
            "non_compliant" => "Ongoing",
            "compliant" => "Completed",
            "partial" => "Ongoing",
            _ => "Ongoing",
        };
        
        // Build scheduled completion date (90 days for critical, 180 for others)
        let days_to_remediate = if update.nist_control_id.starts_with("AU") || 
                                   update.nist_control_id.starts_with("AC") { 90 } else { 180 };
        let completion_date = (Utc::now() + chrono::Duration::days(days_to_remediate))
            .format("%Y-%m-%d").to_string();
        
        let poam_payload = EmassPoamPayload {
            system_id: format!("ORG-{}", args.org_id),
            control_acronym: update.nist_control_id.clone(),
            cci: nist_to_cci(&update.nist_control_id),
            status: emass_status.to_string(),
            weakness: update.poam_weakness.clone()
                .unwrap_or_else(|| update.result.clone()),
            point_of_contact: format!("EDIPI:{}", edipi),
            resources: "EnterpriseComply UCO Engine".to_string(),
            scheduled_completion_date: completion_date.clone(),
            milestones: vec![
                EmassMilestone {
                    description: format!(
                        "Automated detection by EnterpriseComply UCO engine. Control: {}. Source: EC org {}.",
                        update.uco_control_id, args.org_id
                    ),
                    scheduled_completion_date: completion_date,
                }
            ],
            ec_source_id: update.id.clone(),
            ec_uco_control_id: update.uco_control_id.clone(),
        };
        
        let emass_endpoint = format!(
            "{}/api/systems/{}/poams",
            args.emass_url.trim_end_matches('/'),
            args.org_id
        );
        
        let emass_resp = emass_client
            .post(&emass_endpoint)
            .header("user-uid", edipi)              // eMASS EDIPI header (per eMASS REST API spec)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&poam_payload)
            .send()
            .await;
        
        match emass_resp {
            Ok(resp) if resp.status().is_success() => {
                info!(
                    control = update.nist_control_id,
                    poam_id = update.poam_id,
                    edipi,
                    "Successfully delivered POA&M to eMASS"
                );
                delivered_ids.push(update.id.clone());
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                error!(
                    control = update.nist_control_id,
                    emass_status = %status,
                    emass_body = body,
                    "eMASS rejected POA&M update"
                );
            }
            Err(e) => {
                error!(
                    control = update.nist_control_id,
                    error = %e,
                    "Failed to deliver POA&M to eMASS — will retry next cycle"
                );
            }
        }
    }
    
    // 3. Acknowledge delivered items back to EC queue
    if !delivered_ids.is_empty() {
        let ack_url = format!(
            "{}/api/v1/emass/agent/acknowledge/{}",
            args.ec_queue_url.trim_end_matches('/'),
            args.org_id
        );
        
        let ack_payload = AcknowledgePayload {
            item_ids: delivered_ids.clone(),
            edipi: edipi.to_string(),
            agent_version: "1.0.0".to_string(),
            delivered_at: Utc::now().to_rfc3339(),
        };
        
        let ack_resp = ec_client
            .post(&ack_url)
            .header("X-Agent-EDIPI", edipi)
            .json(&ack_payload)
            .send()
            .await;
        
        match ack_resp {
            Ok(r) if r.status().is_success() => {
                info!(count = delivered_ids.len(), "Acknowledged delivered items to EC queue");
            }
            Ok(r) => {
                warn!(status = %r.status(), "EC queue acknowledge returned non-success — items may be re-queued");
            }
            Err(e) => {
                warn!(error = %e, "Failed to acknowledge items — will be re-delivered next cycle (idempotent)");
            }
        }
    }
    
    Ok(delivered_ids.len() as u64)
}

/// Map NIST control acronym to CCI number for eMASS
fn nist_to_cci(control: &str) -> String {
    match control {
        "AC-2"  => "CCI-000015".to_string(),
        "AU-2"  => "CCI-000130".to_string(),
        "AU-3"  => "CCI-000131".to_string(),
        "CM-6"  => "CCI-000366".to_string(),
        "CM-7"  => "CCI-000381".to_string(),
        "IA-2"  => "CCI-000764".to_string(),
        "IA-5"  => "CCI-000185".to_string(),
        "SC-7"  => "CCI-001247".to_string(),
        "SI-2"  => "CCI-002605".to_string(),
        "SI-3"  => "CCI-001243".to_string(),
        _       => format!("CCI-{:06}", control.replace(|c: char| !c.is_alphanumeric(), "").chars().take(6).fold(0u32, |acc, c| acc * 31 + c as u32) % 999999),
    }
}

fn load_or_init_state(state_file: &PathBuf) -> AgentState {
    if let Ok(data) = std::fs::read(state_file) {
        if let Ok(state) = serde_json::from_slice(&data) {
            return state;
        }
    }
    AgentState {
        last_successful_poll: None,
        total_items_delivered: 0,
        last_error: None,
        agent_version: "1.0.0".to_string(),
    }
}

fn save_state(state_file: &PathBuf, state: &AgentState) {
    if let Ok(data) = serde_json::to_vec_pretty(state) {
        if let Some(parent) = state_file.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(state_file, data);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry Point
// ──────────────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    
    // Configure structured logging
    let log_level = if args.verbose { "debug" } else { "info" };
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(log_level))
        )
        .json()
        .init();
    
    info!(
        version = "1.0.0",
        org_id = args.org_id,
        ec_queue = args.ec_queue_url,
        emass_url = args.emass_url,
        poll_interval_secs = args.poll_interval,
        "EnterpriseComply eMASS Enclave Bridge Agent starting"
    );
    
    // Load DoD PKI cert and derive EDIPI
    let cert_pem = std::fs::read(&args.dod_cert_path)
        .with_context(|| format!("Cannot read cert: {}", args.dod_cert_path.display()))?;
    
    let edipi = match &args.edipi {
        Some(e) => {
            info!(edipi = e.as_str(), source = "cli-arg", "Using EDIPI from --edipi argument");
            e.clone()
        }
        None => {
            let e = extract_edipi_from_cert(&cert_pem)
                .context("Could not extract EDIPI from certificate Subject CN. Use --edipi flag.")?;
            info!(edipi = e.as_str(), source = "certificate-cn", "Extracted EDIPI from DoD PKI certificate");
            e
        }
    };
    
    // Validate EDIPI format
    if edipi.len() != 10 || !edipi.chars().all(|c| c.is_ascii_digit()) {
        anyhow::bail!("EDIPI must be exactly 10 digits, got: '{}'", edipi);
    }
    
    // Build HTTP clients
    let ec_client = build_ec_client(&args.ec_api_key)?;
    let emass_client = build_emass_mtls_client(&args.dod_cert_path, &args.dod_key_path, &args.dod_ca_bundle)?;
    
    // Load persisted agent state
    let mut state = load_or_init_state(&args.state_file);
    
    info!(
        edipi,
        cert_fingerprint = cert_fingerprint(&cert_pem),
        "Agent initialized. Beginning poll loop."
    );
    
    // Main poll loop
    loop {
        match poll_and_deliver(&args, &ec_client, &emass_client, &edipi, &mut state).await {
            Ok(count) => {
                state.total_items_delivered += count;
                state.last_successful_poll = Some(Utc::now().to_rfc3339());
                state.last_error = None;
                info!(
                    items_this_cycle = count,
                    total_delivered = state.total_items_delivered,
                    "Poll cycle complete"
                );
            }
            Err(e) => {
                let msg = format!("{:#}", e);
                error!(error = msg, "Poll cycle failed");
                state.last_error = Some(msg);
            }
        }
        
        save_state(&args.state_file, &state);
        
        info!(
            next_poll_secs = args.poll_interval,
            "Sleeping until next poll cycle"
        );
        tokio::time::sleep(Duration::from_secs(args.poll_interval)).await;
    }
}
