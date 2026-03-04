import type { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    searchKey?: string;
    searchPlaceholder?: string;
    children?: React.ReactNode;
}

export function DataTableToolbar<TData>({
    table,
    searchKey,
    searchPlaceholder = 'Search...',
    children,
}: DataTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0;
    const searchValue = searchKey
        ? (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
        : '';

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                {searchKey && (
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={event =>
                                table.getColumn(searchKey)?.setFilterValue(event.target.value)
                            }
                            className="h-9 w-[250px] pl-8"
                        />
                    </div>
                )}
                {isFiltered && (
                    <Button
                        variant="ghost"
                        onClick={() => table.resetColumnFilters()}
                        className="h-9 px-2 lg:px-3"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
            <div className="flex items-center space-x-2">{children}</div>
        </div>
    );
}
