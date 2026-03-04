import { Pencil, Shuffle, Trash, UserIcon, ImageIcon, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createAvatar } from '@dicebear/core';
import { funEmoji } from '@dicebear/collection';
import { useAuth } from '@/providers/auth.provider';

export const UploadAvatar = ({
    avatar,
    setAvatar,
    className,
    setSeed,
    avatarSeed,
    showRandomAvatar = true,
    type = 'avatar',
    isUploading = false,
}: {
    avatar: string | File | null;
    avatarSeed?: string;
    setAvatar: (file: File) => void;
    className?: string;
    setSeed?: (seed: string) => void;
    showRandomAvatar?: boolean;
    type?: 'avatar' | 'logo';
    isUploading?: boolean;
}) => {
    const [randomAvatar, setRandomAvatar] = useState<string>('');
    const avatarRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showRandomAvatar) {
            shuffleRandom(avatarSeed || '');
        }
    }, [avatarSeed]);

    const shuffleRandom = (seed: string) => {
        setSeed(seed);
        const randomAvatar = createAvatar(funEmoji, {
            seed: seed,
        });
        const svg = randomAvatar.toDataUri();
        setRandomAvatar(svg);
    };

    const avatarLink = useMemo(() => {
        if (!avatar) return;
        if (avatar instanceof File) {
            return URL.createObjectURL(avatar);
        }
        return avatar;
    }, [avatar]);

    return (
        <label
            className={`relative inline-block size-30 rounded-full cursor-pointer border-[0.25rem] ml-auto mr-auto ${className} `}
        >
            {avatarLink || randomAvatar ? (
                <img
                    className="w-full h-full object-cover rounded-[50%]"
                    src={avatarLink || randomAvatar}
                    alt="avatar"
                />
            ) : (
                <div className="w-full h-full object-cover  bg-muted-foreground/10 flex items-center justify-center">
                    {type === 'avatar' ? (
                        <UserIcon className="size-5 text-muted-foreground" />
                    ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                    )}
                </div>
            )}

            <input
                type="file"
                className="absolute top-0 left-0 right-0 opacity-0 -z-[1] w-full h-full rounded-[50%] cursor-pointer"
                ref={avatarRef}
                onChange={event => setAvatar(event?.target?.files?.[0] as File)}
                accept="image/*"
                onClick={e => {
                    e.stopPropagation();
                }}
            />
            <span
                className="absolute -bottom-2 -right-2 z-10 cursor-pointer rounded-lg bg-white border flex justify-center items-center p-1 space-x-1"
                onClick={e => {
                    e.stopPropagation();
                }}
            >
                {isUploading ? (
                    <Loader2 className="size-4  text-muted-foreground animate-spin" />
                ) : (
                    <Pencil
                        className="size-4  text-muted-foreground"
                        onClick={() => {
                            // avatarRef.current?.click();
                        }}
                    />
                )}
                {showRandomAvatar && (
                    <Shuffle
                        className="size-4 text-muted-foreground border-s ps-1"
                        onClick={e => {
                            e.preventDefault();
                            shuffleRandom(Math.random().toString());
                        }}
                    />
                )}
            </span>
        </label>
    );
};
