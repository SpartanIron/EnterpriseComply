FROM rust:1.75-slim-bookworm AS builder
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Cargo.toml ./
COPY src/ src/
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/* && groupadd -r ec-agent && useradd -r -g ec-agent -d /opt/ec-agent -s /sbin/nologin ec-agent && mkdir -p /opt/ec-enclave-agent /var/lib/ec-agent /etc/ec-agent/certs && chown ec-agent:ec-agent /opt/ec-enclave-agent /var/lib/ec-agent
COPY --from=builder /build/target/release/ec-enclave-agent /opt/ec-enclave-agent/ec-enclave-agent
RUN chmod +x /opt/ec-enclave-agent/ec-enclave-agent
WORKDIR /opt/ec-enclave-agent
USER ec-agent
VOLUME ["/etc/ec-agent/certs", "/var/lib/ec-agent"]
ENTRYPOINT ["/opt/ec-enclave-agent/ec-enclave-agent"]