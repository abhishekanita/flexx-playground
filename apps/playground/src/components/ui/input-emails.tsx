import { Input } from './input';
import { Button } from './button';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { XIcon } from 'lucide-react';
import { cn } from '@/utils/utils';
import { isValidEmail } from '@/utils/validation';

function InputEmails({
    emails,
    setEmails,
    isError,
}: {
    emails: string[];
    setEmails: (emails: string[]) => void;
    isError: boolean;
}) {
    const handleEmailChange = (index: number, value: string) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
    };

    const handleAddEmail = () => {
        const newEmails = [...emails];
        newEmails.push('');
        setEmails(newEmails);
    };

    const handleRemoveEmail = (index: number) => {
        const newEmails = [...emails];
        newEmails.splice(index, 1);
        setEmails(newEmails);
    };

    const errorIndexes = useMemo(() => {
        if (!isError) return [];
        return emails.map((email, index) => ({
            index,
            isValid: isValidEmail(email),
        }));
    }, [isError, emails]);

    return (
        <div className="flex flex-col space-y-2">
            {emails.map((i, index) => (
                <div key={index} className="relative group">
                    <Input
                        placeholder="Add an email"
                        value={i}
                        onChange={e => handleEmailChange(index, e.target.value)}
                        className={cn(
                            errorIndexes.find(e => e.index === index)?.isValid && 'border-danger'
                        )}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                handleAddEmail();
                            }
                        }}
                    />
                    <div className="absolute right-0 top-0 h-full flex items-center justify-center me-1 transition-opacity duration-300 group-hover:opacity-100 opacity-0">
                        <div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-sm font-normal h-6 w-6 hover:bg-primary/20 hover:text-primary"
                                onClick={() => handleRemoveEmail(index)}
                            >
                                <XIcon className="size-4" />
                            </Button>
                        </div>
                    </div>
                    {isError && !errorIndexes.find(e => e.index === index)?.isValid && (
                        <div className="text-red-500 text-xs ps-2 mb-2">Invalid email</div>
                    )}
                </div>
            ))}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm font-normal hover:bg-primary/20 hover:text-primary"
                    onClick={handleAddEmail}
                >
                    + Invite another
                </Button>
            </div>
        </div>
    );
}

export default InputEmails;
