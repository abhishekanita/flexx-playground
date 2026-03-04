import { marked } from 'marked';
import { memo, Suspense, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
// import { MentionElementStaticMarkdown } from '@/components/plugins/mentions/mention-element-static';

function parseMarkdownIntoBlocks(markdown: string): string[] {
    const tokens = marked.lexer(markdown);
    return tokens.map(token => token.raw);
}

const MemoizedMarkdownBlock = memo(
    ({ content, projectId }: { content: string; projectId: string }) => {
        // allow a custom <mention> tag in sanitized HTML
        const mentionSanitizeSchema = useMemo(() => {
            const base = defaultSchema as any;
            return {
                ...base,
                tagNames: [...(base.tagNames || []), 'mention'],
                attributes: {
                    ...(base.attributes || {}),
                    mention: ['mentiontype', 'id', 'shortid', 'image', 'icon'],
                },
            };
        }, []);
        return (
            <ReactMarkdown
                rehypePlugins={[rehypeRaw, [rehypeSanitize, mentionSanitizeSchema]]}
                components={
                    {
                        mention: ({ node, children, ...props }) => {
                            console.log('node', node);
                            return (
                                <></>
                                // <MentionElementStaticMarkdown
                                //     projectId={projectId}
                                //     mentionType={node.properties.mentiontype}
                                //     mentionId={node.properties.id}
                                //     shortId={node.properties.shortid}
                                //     image={node.properties.image}
                                //     icon={node.properties.icon}
                                //     label={children}
                                // />
                            );
                        },
                        p: ({ node, children, ...props }) => {
                            return (
                                <p className="text-[14.7px]" {...props}>
                                    {children}
                                </p>
                            );
                        },
                        strong: ({ node, children, ...props }) => {
                            return (
                                <span className="font-semibold text-[14.7px]" {...props}>
                                    {children}
                                </span>
                            );
                        },
                        li: ({ node, children, ...props }) => {
                            return (
                                <li {...props} className="ml-4 list-disc  text-[14.7px]">
                                    {children}
                                </li>
                            );
                        },
                        ul: ({ node, children, ...props }) => {
                            return (
                                <ul {...props} className="m-0 p-0 space-y-1.5 flex flex-col mb-3 mt-2 text-[14.7px]">
                                    {children}
                                </ul>
                            );
                        },
                        ol: ({ node, children, ...props }) => {
                            return (
                                <ul {...props} className="m-0 p-0 space-y-1.5 flex flex-col mb-3 mt-2 text-[14.7px]">
                                    {children}
                                </ul>
                            );
                        },
                        h1: ({ node, children, ...props }) => {
                            return (
                                <h1 className="text-lg mt-4 mb-2" {...props}>
                                    {children}
                                </h1>
                            );
                        },
                        h2: ({ node, children, ...props }) => {
                            return (
                                <h2 className="text-lg mt-2 mb-2" {...props}>
                                    {children}
                                </h2>
                            );
                        },
                        h3: ({ node, children, ...props }) => {
                            return (
                                <h1 className="font-medium mt-3 mb-2" {...props}>
                                    {children}
                                </h1>
                            );
                        },
                        a: ({ node, children, ...props }) => {
                            // if (!props?.href?.includes('https:')) {
                            //     return (
                            //         <Link
                            //             to={`/app/project/${projectId}/artifacts/doc/${props.href}`}
                            //             className="font-medium hover:underline cursor-pointer bg-primary/5 rounded-md px-2 py-1 text-primary"
                            //         >
                            //             {children === props.href ? 'Link' : children}
                            //         </Link>
                            //     );
                            // }
                            // try {
                            //     console.log('children', children, node);
                            //     const [type, id] = children?.split(':');
                            //     return (
                            //         <MentionElementStaticMarkdown
                            //             projectId={projectId}
                            //             mentionType={
                            //                 type === 'artifact'
                            //                     ? MentionType.Artifact
                            //                     : MentionType.Task
                            //             }
                            //             mentionId={id}
                            //             shortId={''}
                            //             label={children}
                            //         />
                            //     );
                            // } catch (err) {
                            //     //
                            // }
                            return (
                                <a
                                    className="text-primary underline-offset-4 hover:underline px-1 group-link inline-flex items-center"
                                    rel="noopener noreferrer nofollow "
                                    target="_blank"
                                    {...props}
                                >
                                    {children === props.href ? 'Link' : children}
                                </a>
                            );
                        },
                    } as any
                }
            >
                {content}
            </ReactMarkdown>
        );
    },
    (prevProps, nextProps) => {
        if (prevProps.content !== nextProps.content) return false;
        return true;
    }
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedMarkdown = memo(({ content, id, projectId }: { content: string; id?: string; projectId?: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
    return (
        <Suspense fallback={<div>md issue...</div>}>
            {blocks.map((block, index) => (
                <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} projectId={projectId} />
            ))}
        </Suspense>
    );
});

MemoizedMarkdown.displayName = 'MemoizedMarkdown';
