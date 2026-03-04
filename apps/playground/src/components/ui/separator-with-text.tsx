import { cn } from '@/utils/utils';

const SeparatorWithText = ({
    text,
    className,
    textClassName,
    align = 'center',
}: {
    text: string | any;
    className?: string;
    textClassName?: string;
    align?: 'start' | 'center' | 'end';
}) => {
    return (
        <div className={`relative ${className}`}>
            <div className={cn(`absolute inset-0 flex items-center`)}>
                <span className="w-full border-t" />
            </div>
            <div
                className={cn(
                    'relative flex  text-xs uppercase',
                    align === 'start' && 'justify-start',
                    align === 'center' && 'justify-center',
                    align === 'end' && 'justify-end'
                )}
            >
                <span className={cn('bg-background  text-muted-foreground', textClassName)}>
                    {text}
                </span>
            </div>
        </div>
    );
};

export default SeparatorWithText;
