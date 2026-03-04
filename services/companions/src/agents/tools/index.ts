import { sendMessageTool } from './send-message.tool';
import { knowledgeSearchTool } from './knowledge-search.tool';
import { loadSkillTool } from './load-skill.tool';
import { upiMandatesTool } from './upi-mandates';

export enum ToolName {
    SEND_MESSAGE = 'send_message',
    KNOWLEDGE_SEARCH = 'knowledge_search',
    LOAD_SKILL = 'load_skill',
    UPI_MANDATES = 'upi_mandates',
}

export const tools = [sendMessageTool, knowledgeSearchTool, loadSkillTool, upiMandatesTool];

export const toolMap: Record<string, typeof sendMessageTool> = {
    [ToolName.SEND_MESSAGE]: sendMessageTool,
    [ToolName.KNOWLEDGE_SEARCH]: knowledgeSearchTool,
    [ToolName.LOAD_SKILL]: loadSkillTool,
    [ToolName.UPI_MANDATES]: upiMandatesTool,
};
