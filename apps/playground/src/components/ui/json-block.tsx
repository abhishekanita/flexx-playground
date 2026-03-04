import { cn } from '@/utils/utils';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Register JSON language
SyntaxHighlighter.registerLanguage('json', json);

const CopyButton = ({ value }: { value: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="flex shrink-0 items-center gap-1 rounded-md p-1 text-xs text-gray-400 hover:bg-black/5 hover:text-gray-600"
        >
            <Copy className="h-3 w-3" />
            {copied && <span className="text-green-500">Copied!</span>}
        </button>
    );
};

interface JsonBlockProps {
    data: unknown;
    title: string;
    maxHeight?: string;
    className?: string;
}

export const JsonBlock = ({ data, title, maxHeight = 'max-h-48', className }: JsonBlockProps) => {
    const formattedJson = JSON.stringify(data, null, 2);

    return (
        <div className={cn('flex flex-col flex-1 min-w-0', className)}>
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <span className="text-xs font-medium text-gray-500">{title}</span>
                <CopyButton value={formattedJson} />
            </div>
            <div className={cn('overflow-auto rounded-b-lg', maxHeight)}>
                <SyntaxHighlighter
                    language="json"
                    style={atomOneLight}
                    customStyle={{
                        margin: 0,
                        padding: '8px',
                        fontSize: '11px',
                        background: 'white',
                        borderRadius: '0 0 8px 8px',
                    }}
                >
                    {formattedJson}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

interface TextBlockProps {
    text: string;
    title: string;
    maxHeight?: string;
    className?: string;
}

export const TextBlock = ({ text, title, maxHeight = 'max-h-48', className }: TextBlockProps) => {
    return (
        <div className={cn('flex flex-col flex-1 min-w-0', className)}>
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <span className="text-xs font-medium text-gray-500">{title}</span>
                <CopyButton value={text} />
            </div>
            <pre className={cn('text-xs p-2 whitespace-pre-wrap overflow-auto', maxHeight)}>{text}</pre>
        </div>
    );
};
