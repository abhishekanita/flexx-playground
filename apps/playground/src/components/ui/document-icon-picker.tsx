'use client';

import { useState } from 'react';

import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmojiPickerEmojiPicker } from '../ui/emoji-picker';

export const DocumentIconPicker = ({ children, onRemove, onChange }: { children: React.ReactNode; onRemove?: any; onChange?: any }) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-full p-0 relative bg-white z-[10000000]">
                <Tabs defaultValue="emojis">
                    <TabsList className="w-full">
                        <TabsTrigger value="emojis">Emojis</TabsTrigger>

                        <Button variant="ghost" className="ml-auto" onClick={onRemove}>
                            Remove
                        </Button>
                    </TabsList>

                    <TabsContent value="emojis">
                        <EmojiPickerEmojiPicker setValue={e => onChange(e)} />
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
};
