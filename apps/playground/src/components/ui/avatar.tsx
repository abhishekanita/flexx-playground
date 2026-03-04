import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/utils/utils';
import { createAvatar } from '@dicebear/core';
import { lorelei, adventurer, glass, funEmoji } from '@dicebear/collection';
import CustomImage from './custom-image';
import { Loader2 } from 'lucide-react';

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
            {...props}
        />
    );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
    return (
        <AvatarPrimitive.Image
            data-slot="avatar-image"
            className={cn('aspect-square size-full object-cover', className)}
            {...props}
        />
    );
}

function AvatarFallback({
    className,
    ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                'bg-muted flex size-full items-center justify-center rounded-md',
                className
            )}
            {...props}
        />
    );
}

function UserAvatar({
    name,
    avatar,
    avatarSeed,
    variant = 'md',
    isOnline,
    isLoading,
    bg,
    className,
    imageClassName,
}: {
    name: string;
    avatar?: string;
    avatarSeed: string;
    variant?: 'sm' | 'md' | 'lg' | 'xl';
    isOnline?: boolean;
    isLoading?: boolean;
    bg?: string;
    className?: string;
    imageClassName?: string;
}) {
    const variants = {
        sm: 'size-4 !rounded-md flex items-center justify-center',
        md: 'size-8 rounded-md',
        lg: 'size-10 rounded-lg bg-muted',
        xl: 'size-13 rounded-lg bg-muted',
    };
    const randomAvatar = createAvatar(funEmoji, {
        seed: avatarSeed,
    });
    const svg = randomAvatar.toDataUri();

    const colorClasses = [
        'border-0 border-red-200 bg-red-100/30',
        'border-0 border-orange-200 bg-orange-100/30',
        'border-0 border-amber-200 bg-amber-100/30',
        'border-0 border-yellow-200 bg-yellow-100/30',
        'border-0 border-lime-200 bg-lime-100/30',
        'border-0 border-green-200 bg-green-100/30',
        'border-0 border-emerald-200 bg-emerald-100/30',
        'border-0 border-teal-200 bg-teal-100/30',
        'border-0 border-cyan-200 bg-cyan-100/30',
        'border-0 border-sky-200 bg-sky-100/30',
        'border-0 border-blue-200 bg-blue-100/30',
    ];
    const seedHash = Array.from(avatarSeed ?? '').reduce(
        (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0,
        0
    );
    const seedIndex = seedHash % colorClasses.length; // 0..10
    const fallbackBg = bg ?? colorClasses[seedIndex];

    return (
        <Avatar className={cn(variants[variant], 'overflow-hidden', className)}>
            {avatar ? (
                <CustomImage
                    src={avatar}
                    className={cn(variants[variant], 'object-cover ', imageClassName)}
                    alt={name}
                    fallback={
                        <AvatarFallback className={cn('!rounded-md', fallbackBg)}>
                            <img src={svg} alt={name} className="w-full h-full object-cover" />
                        </AvatarFallback>
                    }
                    containerClassName="w-full h-full flex items-center justify-center "
                />
            ) : (
                <AvatarFallback className={cn('!rounded-md', fallbackBg)}>
                    <img src={svg} alt={name} className="w-full h-full object-cover" />
                </AvatarFallback>
            )}
            {isOnline && (
                <span className="absolute bottom-[-1.4px] end-[-1.4px] size-2 rounded-full border-2 border-muted bg-emerald-500">
                    <span className="sr-only">Online</span>
                </span>
            )}
            {isLoading && (
                <span className="absolute bottom-[-3px] end-[-3px] bg-white rounded border">
                    <Loader2 className="animate-spin size-3" />
                </span>
            )}
        </Avatar>
    );
}

const LoreleiAvatar = ({ seed }) => {
    const randomAvatar = createAvatar(funEmoji, {
        seed: seed + '',
    });
    const svg = randomAvatar.toDataUri();

    return <img src={svg} className=" object-cover rounded-full" />;
};

export { Avatar, AvatarImage, AvatarFallback, UserAvatar, LoreleiAvatar };
