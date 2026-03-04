import { Button } from '@/components/ui/button';
import { cn } from '@/utils/utils';
import { Banknote, Circle, Mail, Settings2 } from 'lucide-react';
import type { IntegrationWithStatus } from '../types/integration.type';

const INTEGRATION_STYLES: Record<
    string,
    { icon: React.ReactNode; iconColor: string; iconBg: string }
> = {
    gmail: {
        icon: <Mail className="size-4" />,
        iconColor: 'text-red-600 dark:text-red-400',
        iconBg: 'bg-red-50 dark:bg-red-950/40',
    },
    npci: {
        icon: <Banknote className="size-4" />,
        iconColor: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    },
};

const DEFAULT_STYLE = {
    icon: <Circle className="size-4" />,
    iconColor: 'text-muted-foreground',
    iconBg: 'bg-secondary',
};

interface IntegrationCardProps {
    integration: IntegrationWithStatus;
    onConnect: (id: string) => void;
}

export const IntegrationCard = ({ integration, onConnect }: IntegrationCardProps) => {
    const style = INTEGRATION_STYLES[integration.id] ?? DEFAULT_STYLE;

    return (
        <div
            className={cn(
                'flex items-center gap-4 px-4 py-3.5',
                'transition-colors duration-150',
                'hover:bg-accent/50'
            )}
        >
            <div
                className={cn(
                    'flex shrink-0 items-center justify-center size-9 rounded-lg',
                    style.iconBg,
                    style.iconColor
                )}
            >
                {style.icon}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{integration.name}</span>
                    {integration.isConnected && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Connected
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {integration.description}
                </p>
                {integration.isConnected && integration.connectionMeta && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {integration.connectionMeta.email}
                        {integration.connectionMeta.phoneNumber}
                    </p>
                )}
            </div>

            <div className="shrink-0">
                {!integration.isConnected ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onConnect(integration.id)}
                    >
                        Connect
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                        <Settings2 className="size-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );
};
