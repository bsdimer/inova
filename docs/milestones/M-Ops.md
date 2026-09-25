# M-Ops — Environments, monitoring, runbooks

**Status:** Test environment deployed; the rest not started. **Effort / sequencing:** M, continuous from M0.

Part of the [implementation plan](../implementation-plan.md). Milestone order and dependencies are in its §7. Section numbers (§) are the plan's own; its index maps each § to a file.

## Goal

Environments, deploys from GitHub Actions, observability, backups, runbooks.

**Two stages (D19, decided 2026-09-21).** _Pilot:_ production is a single VM
running the compose stack already proven on test — its own database, Redis,
JWT key and secrets, nightly encrypted off-box `pg_dump`, one rehearsed
restore, uptime check, Sentry, log retention. _Scale-out:_ the EKS / Terraform /
RDS design below, started at roughly 1,000+ managed apartments or the first
external tenant. Below that the cluster costs more than the platform earns
(~120 EUR/month at 150 apartments against a ~74 USD control plane before
nodes, RDS and NAT). Containers are stateless and configured by env only, so
the move is a deployment change.

The sections below describe the scale-out stage.

## Dependencies

M0; AWS account.

## Infra

Terraform: VPC, EKS, RDS, ElastiCache, S3, SES, Secrets Manager, CloudFront (admin SPA + attachments); Helm charts for api/worker; GitHub Actions deploy with environment protection; kube-prometheus-stack + Loki; Sentry projects; PostHog project; alerting to Slack (error rate, queue depth, DB CPU, disk, cert expiry, failed webhook count).

## Runbooks (docs/runbooks/)

Deploy/rollback, DB restore drill, incident response, webhook replay, push-token cleanup, on-call basics.

## Acceptance

Merge → staging auto-deploy; tagged release → production with manual approval; restore drill executed once; synthetic uptime check on `/health`.
