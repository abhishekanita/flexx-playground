import fs from 'fs';
import path from 'path';
import { ToolName } from '../tools';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentProfile {
    agentId: string;
    prompt: string;
    allowedTools: ToolName[];
    model?: string;
}

export interface PromptModule {
    name: string;
    path: string; // relative to modules/ dir
}

export interface AgentConfig {
    agentId: string;
    modules: PromptModule[];
    allowedTools: ToolName[];
    model?: string;
}

// ─── Prompt composer ─────────────────────────────────────────────────────────

const MODULES_DIR = path.join(__dirname, 'modules');

function readModule(modulePath: string): string {
    return fs.readFileSync(path.join(MODULES_DIR, modulePath), 'utf-8');
}

export function buildPrompt(config: AgentConfig): string {
    return config.modules
        .map(m => readModule(m.path))
        .join('\n\n---\n\n');
}

// ─── Default module order helper ─────────────────────────────────────────────

function defaultModules(agentDir: string): PromptModule[] {
    return [
        { name: 'identity', path: `${agentDir}/identity.md` },
        { name: 'voice', path: `${agentDir}/voice.md` },
        { name: 'context', path: `${agentDir}/context.md` },
        { name: 'knowledge', path: `${agentDir}/knowledge.md` },
        { name: 'behavioral-rules', path: 'shared/behavioral-rules.md' },
        { name: 'cohort-calibration', path: 'shared/cohort-calibration.md' },
        { name: 'emotional-handling', path: 'shared/emotional-handling.md' },
        { name: 'response-format', path: 'shared/response-format.md' },
        { name: 'examples', path: `${agentDir}/examples.md` },
    ];
}

// ─── Agent configs ───────────────────────────────────────────────────────────

const SHARED_TOOLS: ToolName[] = [
    ToolName.SEND_MESSAGE,
    ToolName.KNOWLEDGE_SEARCH,
    ToolName.LOAD_SKILL,
];

export const agentConfigs: AgentConfig[] = [
    {
        agentId: 'arjun',
        modules: defaultModules('arjun'),
        allowedTools: [...SHARED_TOOLS, ToolName.UPI_MANDATES],
    },
    {
        agentId: 'vikram',
        modules: defaultModules('vikram'),
        allowedTools: SHARED_TOOLS,
    },
    {
        agentId: 'ace',
        modules: defaultModules('ace'),
        allowedTools: SHARED_TOOLS,
    },
    {
        agentId: 'siddharth',
        modules: defaultModules('siddharth'),
        allowedTools: SHARED_TOOLS,
    },
    {
        agentId: 'samir',
        modules: defaultModules('samir'),
        allowedTools: SHARED_TOOLS,
    },
    {
        agentId: 'coach-raj',
        modules: defaultModules('coach-raj'),
        allowedTools: SHARED_TOOLS,
    },
];

// ─── Build profiles (backward-compatible with Agent class) ───────────────────

export const agentProfiles: AgentProfile[] = agentConfigs.map(config => ({
    agentId: config.agentId,
    prompt: buildPrompt(config),
    allowedTools: config.allowedTools,
    model: config.model,
}));
