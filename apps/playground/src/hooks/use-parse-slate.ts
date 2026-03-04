import type { MyMentionElement } from '@/components/plugins/mentions/types';
import type { Editor } from 'platejs';
import { toast } from 'sonner';

export const useParseSlate = () => {
    const getMentions = (editor: Editor) => {
        const mentions = editor.children
            .map((node: any) => {
                if (node.children) {
                    return node.children.map((child: MyMentionElement) => {
                        console.log(child);
                        if (child.type === 'mention') {
                            return {
                                key: child.key,
                                value: child.value,
                                mentionType: child.mentionType,
                                image: child.image,
                                icon: child.icon,
                            };
                        }
                        return null;
                    });
                }
                if (node.type === 'mention') {
                    return {
                        key: node.key,
                        value: node.value,
                        mentionType: node.mentionType,
                        image: node.image,
                        icon: node.icon,
                    };
                }
                return null;
            })
            .flat()
            .filter(Boolean);
        return mentions.map(i => ({
            type: i.key,
            id: i.key,
            name: i.value,
            mentionType: i.mentionType,
            image: i.image,
            icon: i.icon,
        }));
    };

    const parseSlateMessage = (editor: Editor, members: any) => {
        if (
            editor.children.length > 1 &&
            editor.children[editor.children.length - 1].type === 'p' &&
            editor.children[editor.children.length - 1].children.length === 1 &&
            editor.children[editor.children.length - 1].children[0].text === ''
        ) {
            editor.children.pop();
        }

        const markdownOutput = (editor.api as any).markdown.serialize()?.trim();

        const mentions = getMentions(editor);
        console.log('mentions', mentions, markdownOutput);
        const mentionedUsers = mentions.filter(i => i.mentionType === 'user');
        const mentionedAgents = mentions.filter(i => i.mentionType === 'agent');
        const mentionedDocs = mentions.filter(i => i.mentionType === 'doc');
        const mentionedTasks = mentions.filter(i => i.mentionType === 'task');

        // if (mentionedUsers && mentionedUsers.length > 0) {
        //     const areAllUsersChannelMembers = mentionedUsers.every(i => !!members[i.id]);
        //     if (!areAllUsersChannelMembers) {
        //         toast.error('You are not a member of this channel');
        //     }
        // }
        return {
            markdownOutput,
            mentionedUsers,
            mentionedDocs,
            mentionedAgents,
            mentionedTasks,
        };
    };

    return {
        parseSlateMessage,
    };
};
