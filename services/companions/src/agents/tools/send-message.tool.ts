import { Tool } from 'ai';
import z from 'zod';

export const sendMessageTool: Tool = {
    description: 'Use this tool to send a message to the user',
    inputSchema: z.object({
        message: z.string().describe('The message to send to the user'),
    }),
    execute: async ({ message }) => {
        return {
            success: true,
            message,
        };
    },
};
