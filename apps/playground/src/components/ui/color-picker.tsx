import React, { useEffect } from 'react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ThemeColorKey = 'primary' | 'accent' | 'background' | 'text' | 'secondary' | 'font';

interface ColorPickerDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    defaultColor?: string;
    colorKey?: ThemeColorKey;
    onSave?: (colorKey: ThemeColorKey, color: string) => void;
}

const colorKeyLabels: Record<ThemeColorKey, string> = {
    primary: 'Primary Color',
    accent: 'Accent Color',
    background: 'Background Color',
    text: 'Text Color',
    secondary: 'Secondary Color',
    font: 'Font',
};

export default function ColorPickerDialog({ isOpen, setIsOpen, defaultColor = '#3b82f6', colorKey, onSave }: ColorPickerDialogProps) {
    const [selectedColor, setSelectedColor] = React.useState(defaultColor);
    const presetColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0f172a', '#ffffff'];

    // Update selected color when defaultColor changes
    useEffect(() => {
        setSelectedColor(defaultColor);
    }, [defaultColor]);

    const handleSave = () => {
        if (colorKey && onSave) {
            onSave(colorKey, selectedColor);
        }
        setIsOpen(false);
    };

    const title = colorKey ? colorKeyLabels[colorKey] : 'Select Color';

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2 block text-sm font-medium">Preset Colors</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {presetColors.map(color => (
                                    <button
                                        key={color}
                                        className={`h-10 w-full rounded-lg border-2 transition-all ${
                                            selectedColor === color ? 'border-foreground scale-105 ring-2 ring-offset-2 ring-foreground/20' : 'border-transparent hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setSelectedColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="custom-color" className="mb-2 block text-sm font-medium">
                                Custom Color
                            </Label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    id="custom-color"
                                    value={selectedColor}
                                    onChange={e => setSelectedColor(e.target.value)}
                                    className="aspect-square h-10 w-10 cursor-pointer rounded-md border p-0"
                                />
                                <Input
                                    value={selectedColor}
                                    onChange={e => setSelectedColor(e.target.value)}
                                    placeholder="#000000"
                                    className="flex-1 font-mono"
                                />
                            </div>
                        </div>
                        {/* Preview */}
                        <div>
                            <Label className="mb-2 block text-sm font-medium">Preview</Label>
                            <div
                                className="h-16 w-full rounded-lg border flex items-center justify-center"
                                style={{ backgroundColor: selectedColor }}
                            >
                                <span
                                    className="font-mono text-sm px-2 py-1 rounded"
                                    style={{
                                        color: isLightColor(selectedColor) ? '#000' : '#fff',
                                        backgroundColor: isLightColor(selectedColor) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                                    }}
                                >
                                    {selectedColor.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave} style={{ backgroundColor: selectedColor }} className="text-white">
                        Apply Color
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Helper to determine if a color is light or dark
function isLightColor(hex: string): boolean {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return true;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    // Using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}
