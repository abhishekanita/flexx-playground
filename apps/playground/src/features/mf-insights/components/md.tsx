interface MDProps {
    text: string;
    accentColor?: string;
    className?: string;
}

export function MD({ text, accentColor, className }: MDProps) {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Match **bold** first
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Match *italic*
        const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

        const boldIndex = boldMatch?.index ?? Infinity;
        const italicIndex = italicMatch?.index ?? Infinity;

        if (boldIndex === Infinity && italicIndex === Infinity) {
            parts.push(<span key={key++}>{remaining}</span>);
            break;
        }

        if (boldIndex <= italicIndex && boldMatch) {
            // Text before bold
            if (boldIndex > 0) {
                parts.push(<span key={key++}>{remaining.slice(0, boldIndex)}</span>);
            }
            parts.push(
                <strong
                    key={key++}
                    className="font-bold"
                    style={accentColor ? { color: accentColor } : undefined}
                >
                    {boldMatch[1]}
                </strong>
            );
            remaining = remaining.slice(boldIndex + boldMatch[0].length);
        } else if (italicMatch) {
            if (italicIndex > 0) {
                parts.push(<span key={key++}>{remaining.slice(0, italicIndex)}</span>);
            }
            parts.push(
                <em key={key++} className="not-italic opacity-80 font-medium">
                    {italicMatch[1]}
                </em>
            );
            remaining = remaining.slice(italicIndex + italicMatch[0].length);
        }
    }

    return <span className={className}>{parts}</span>;
}
