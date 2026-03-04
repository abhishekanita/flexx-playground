🧠 Cohack — Product Context
Mission

Cohack is building the Growth Coworker — an AI-powered IDE for growth and marketing automation.
It helps early-stage digital teams (founders, first marketers, growth hackers) launch, orchestrate, and optimize growth workflows — from content scraping to campaign launches — as easily as they would code.

🏗️ System Overview

1. Core Concept: Growth Coworker

A “marketing IDE” where workflows = growth hacks.
Each workflow automates end-to-end marketing or research tasks such as:

Reddit/LinkedIn scraping for user discovery

Cold outreach and email sequences

Content scheduling and generation

Analytics and reporting

Product Hunt or community launches

Users can launch, monitor, and iterate on these workflows inside the platform — as if collaborating with a real coworker.

2. Multi-Agent Architecture

Cohack uses a multi-agent system:

Lead Agent (like “Donna”) orchestrates sessions, coordinates worker agents, and manages context.

Worker Agents execute specialized tasks (developer, researcher, writer, etc.).

Mini-Agents run isolated E2B sandboxes for short-lived, focused operations.

Each agent’s profile is defined in YAML with:

Model configuration

Tool access (API clients, SDKs, workflows)

System prompts / behavioral rules

Agents share a context layer backed by MongoDB, Yjs, and Liveblocks.
They maintain short-, mid-, and long-term memory via vector embeddings, periodically compressed with models like LLMLingua-2 or SnapKV.

3. Data & Infrastructure

Event Stream: All actions (messages, API calls, logs) flow into a global event stream.

Event Ingestor: Updates agent context and metrics based on new events.

Storage Layers:

MongoDB → context, state, and event logs

S3 + Glue + Athena → analytics data lake

Redis + BullMQ → queues, concurrency, and rate-limit control

Supabase → embedded SQL DBs inside workflows

Deployment: AWS (Lambda, API Gateway, S3, EC2, EventBridge, CodeArtifact, CDK Stacks).

SDK: Private NPM package @cohack/client with typed APIs to access workflows, LLMs, apps, and artifacts.

4. SDK (@cohack/client)

A typed TypeScript SDK that exposes all server APIs:

client.apps.reddit.createPost()
client.wf.runs.createRun()
client.llm.generateText()
client.artifacts.supabase.createTable()
client.artifacts.agent.create()

Features:

Type-safe requests/responses (Zod)

Built-in error handling & middleware

Configurable via CohackClient.init({ apiKey, baseUrl })

5. Workflow Engine

Each workflow is:

Defined as YAML + code bundle (executed in sandbox or Lambda)

Versioned and deployed via CDK

Connected to monitoring and logging

Triggered manually or on schedule (EventBridge)

Core operations:

updateContext, appendLog, completeRun, requestApproval

updateDeploymentMetadata after deployment

Rate-limit handling with Redis tracking and auto-throttling

Optional proxy routing for certain APIs (e.g. LinkedIn, Reddit)

6. Product Modules

Inbox: Displays recent runs, errors, and approvals.

Hackers (Agents): Manage all agents with their YAML profiles.

Workflows: View, create, deploy, and monitor automations.

Library: Browse shared growth hacks (Reddit Scraper, Cold Emailer, etc.).

Dashboard: See analytics, credits, and system health.

7. Design & Brand Identity

Theme: Momentum, speed, precision — “Too Fast to Copy.”

Visual Language:

Deep forest green × copper-gold × white

Lowercase modern sans (fashion-editorial tone)

Dynamic grid / kinetic motion background

Tone: Confident, minimal, slightly rebellious — “built for builders.”

8. Reliability & Governance

Queue monitoring dashboards (BullMQ + Redis)

Session concurrency limits (per workplace, per project)

Sentry error alerting

Rate-limit + proxy awareness

IAM automation for workflow-specific deployers

Credit ledger for LLM and API usage

Logs stored both in AWS CloudWatch and MongoDB

9. Long-Term Vision

Cohack evolves into a “Marketing Operating System” —
a full stack of agents, workflows, and data infrastructure that automates growth like DevOps automates deployment.

Future layers:

RL-driven optimization of workflows

Template recommendation engine

Public growth-hack marketplace

SDK-based developer ecosystem

10. Tech Stack (Summary)
    Layer Technology
    Frontend React + Tailwind + shadcn/ui
    Backend Node.js + AWS Lambda + CDK
    Database MongoDB, Redis, Supabase, Athena
    Messaging BullMQ, EventBridge
    SDK TypeScript, Zod, Axios
    Infra AWS CodeArtifact, IAM, CloudFormation
    Collaboration Yjs + Liveblocks
    Monitoring Sentry + CloudWatch
    Agents E2B Sandboxes, LLMs (GPT-4/5 class)
11. Ethos

“Cohack helps you ship faster than teams 10× your size — by giving you a marketing coworker that never sleeps.”
