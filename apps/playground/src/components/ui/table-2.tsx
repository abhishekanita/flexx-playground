import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/utils/utils';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { TableProperties, GripVertical } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ColumnDef<T> {
    /** Unique identifier for the column */
    key: string;
    /** Header label to display */
    header: string;
    /** Initial width in pixels */
    width?: number;
    /** Minimum width when resizing */
    minWidth?: number;
    /** Maximum width when resizing */
    maxWidth?: number;
    /** Custom cell renderer */
    cell?: (row: T, rowIndex: number) => React.ReactNode;
    /** Accessor function to get value from row (used if no cell renderer) */
    accessor?: (row: T) => React.ReactNode;
    /** Whether column can be hidden (default: true) */
    hideable?: boolean;
    /** Whether column is visible by default (default: true) */
    defaultVisible?: boolean;
    /** Header cell className */
    headerClassName?: string;
    /** Cell className */
    cellClassName?: string;
    /** Whether the column should grow to fill available space */
    grow?: boolean;
}

export interface DataTableProps<T> {
    /** Column definitions */
    columns: ColumnDef<T>[];
    /** Data rows */
    data: T[];
    /** Unique key accessor for each row */
    getRowKey: (row: T, index: number) => string | number;
    /** Enable column resizing */
    isResizable?: boolean;
    /** Show column visibility toggle button */
    showColumnsConfig?: boolean;
    /** Table aria-label for accessibility */
    ariaLabel?: string;
    /** Callback when column visibility changes */
    onColumnVisibilityChange?: (visibleColumns: string[]) => void;
    /** Callback when column widths change */
    onColumnWidthChange?: (columnKey: string, width: number) => void;
    /** Custom className for table container */
    className?: string;
    /** Empty state content */
    emptyState?: React.ReactNode;
    /** Row click handler */
    onRowClick?: (row: T, index: number) => void;
    /** Row className */
    rowClassName?: string | ((row: T, index: number) => string);
}

// ============================================================================
// Resizable Column Hook
// ============================================================================

function useResizableColumns<T>(
    columns: ColumnDef<T>[],
    isResizable: boolean,
    onColumnWidthChange?: (columnKey: string, width: number) => void
) {
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        columns.forEach(col => {
            if (!col.grow) {
                widths[col.key] = col.width ?? 150;
            }
        });
        return widths;
    });

    const resizingRef = useRef<{
        columnKey: string;
        startX: number;
        startWidth: number;
    } | null>(null);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent, columnKey: string) => {
            if (!isResizable) return;
            e.preventDefault();
            const currentWidth = columnWidths[columnKey];
            let startWidth = currentWidth;

            // If width isn't tracked yet (e.g. grow column), get it from DOM
            if (startWidth === undefined) {
                const th = (e.currentTarget as Element).closest('th');
                if (th) {
                    startWidth = th.getBoundingClientRect().width;
                } else {
                    startWidth = 150;
                }
            }

            resizingRef.current = {
                columnKey,
                startX: e.clientX,
                startWidth,
            };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        },
        [isResizable, columnWidths]
    );

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;

            const { columnKey, startX, startWidth } = resizingRef.current;
            const diff = e.clientX - startX;
            const column = columns.find(c => c.key === columnKey);
            const minWidth = column?.minWidth ?? 50;
            const maxWidth = column?.maxWidth ?? 1000;
            const newWidth = Math.min(Math.max(startWidth + diff, minWidth), maxWidth);

            setColumnWidths(prev => ({
                ...prev,
                [columnKey]: newWidth,
            }));
        };

        const handleMouseUp = () => {
            if (resizingRef.current) {
                const { columnKey } = resizingRef.current;
                onColumnWidthChange?.(columnKey, columnWidths[columnKey]);
            }
            resizingRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [columns, columnWidths, onColumnWidthChange]);

    return { columnWidths, handleMouseDown, isResizing: !!resizingRef.current };
}

// ============================================================================
// Column Visibility Hook
// ============================================================================

function useColumnVisibility<T>(columns: ColumnDef<T>[], onColumnVisibilityChange?: (visibleColumns: string[]) => void) {
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        const visible = new Set<string>();
        columns.forEach(col => {
            if (col.defaultVisible !== false) {
                visible.add(col.key);
            }
        });
        return visible;
    });

    const toggleColumn = useCallback(
        (columnKey: string) => {
            setVisibleColumns(prev => {
                const next = new Set(prev);
                if (next.has(columnKey)) {
                    next.delete(columnKey);
                } else {
                    next.add(columnKey);
                }
                onColumnVisibilityChange?.(Array.from(next));
                return next;
            });
        },
        [onColumnVisibilityChange]
    );

    const isColumnVisible = useCallback((columnKey: string) => visibleColumns.has(columnKey), [visibleColumns]);

    return { visibleColumns, toggleColumn, isColumnVisible };
}

export function DataTable<T>({
    columns,
    data,
    getRowKey,
    isResizable = false,
    showColumnsConfig = false,
    ariaLabel = 'Data table',
    onColumnVisibilityChange,
    onColumnWidthChange,
    className,
    emptyState,
    onRowClick,
    rowClassName,
}: DataTableProps<T>) {
    const { columnWidths, handleMouseDown } = useResizableColumns(columns, isResizable, onColumnWidthChange);
    const { toggleColumn, isColumnVisible } = useColumnVisibility(columns, onColumnVisibilityChange);

    const visibleCols = columns.filter(col => isColumnVisible(col.key));
    const hideableCols = columns.filter(col => col.hideable !== false);

    const renderCellContent = (column: ColumnDef<T>, row: T, rowIndex: number) => {
        if (column.cell) {
            return column.cell(row, rowIndex);
        }
        if (column.accessor) {
            return column.accessor(row);
        }
        // Fallback: try to access by key
        return (row as Record<string, unknown>)[column.key] as React.ReactNode;
    };

    const getRowClassName = (row: T, index: number) => {
        if (typeof rowClassName === 'function') {
            return rowClassName(row, index);
        }
        return rowClassName;
    };

    return (
        <div className={cn('overflow-hidden rounded-xl border ', className)}>
            <div className="relative h-full overflow-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
                <table
                    className="border-collapse border-spacing-0 bg-gray-50 w-full "
                    aria-label={ariaLabel}
                    style={{ tableLayout: 'fixed' }}
                >
                    <thead className="sticky top-0 z-10 bg-gray-100/80 rounded-xl drop-shadow-[0px_1px_0px_rgba(0,0,0,0.1)] backdrop-blur-xl backdrop-saturate-200">
                        <tr>
                            {visibleCols.map((column, colIndex) => (
                                <th
                                    key={column.key}
                                    className={cn(
                                        'cursor-default py-2 pl-2 text-start text-xs font-semibold text-gray-700 last:pr-2',
                                        'focus-within:z-20 [&:hover]:z-20',
                                        column.headerClassName
                                    )}
                                    style={{
                                        width: columnWidths[column.key] ?? column.width ?? (column.grow ? 'auto' : 150),
                                        minWidth: column.minWidth ?? 50,
                                    }}
                                >
                                    <div className="relative flex items-center">
                                        <div className="flex h-5 flex-1 items-center gap-1 overflow-hidden">
                                            <span className="block max-w-full truncate">{column.header}</span>
                                        </div>
                                        {showColumnsConfig && colIndex === visibleCols.length - 1 && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        className="ml-2 flex items-center justify-center rounded-xs p-0.5 text-gray-600 hover:bg-black/5"
                                                        aria-label="Configure columns"
                                                    >
                                                        <TableProperties className="h-4 w-4 text-gray-500" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    {hideableCols.map(col => (
                                                        <DropdownMenuCheckboxItem
                                                            key={col.key}
                                                            checked={isColumnVisible(col.key)}
                                                            onCheckedChange={() => toggleColumn(col.key)}
                                                        >
                                                            {col.header}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}

                                        {/* Resizer */}
                                        {isResizable && colIndex < visibleCols.length - 1 && (
                                            <div
                                                className="absolute right-0 box-content h-5 w-px cursor-col-resize rounded-sm bg-gray-400 bg-clip-content px-2 py-1 hover:bg-blue-600 hover:w-0.5"
                                                onMouseDown={e => handleMouseDown(e, column.key)}
                                                role="separator"
                                                aria-orientation="vertical"
                                            >
                                                <GripVertical className="h-3 w-3 text-gray-400 opacity-0 hover:opacity-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={visibleCols.length} className="py-8 text-center text-sm text-gray-500" data-table-empty="true">
                                    {emptyState ?? 'No data available'}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIndex) => (
                                <tr
                                    key={getRowKey(row, rowIndex)}
                                    className={cn(
                                        'group/row relative cursor-default text-sm text-gray-900 transition bg-white',
                                        'hover:bg-gray-50',
                                        onRowClick && 'cursor-pointer',
                                        getRowClassName(row, rowIndex)
                                    )}
                                    onClick={() => onRowClick?.(row, rowIndex)}
                                >
                                    {visibleCols.map(column => (
                                        <td
                                            key={column.key}
                                            className={cn(
                                                'truncate border-b py-2 pl-2 text-xs font-medium text-zinc-600',
                                                'group-last/row:border-b-0 last:pr-2',
                                                'align-middle',
                                                column.cellClassName
                                            )}
                                            style={{
                                                width: columnWidths[column.key] ?? column.width ?? (column.grow ? 'auto' : 150),
                                                minWidth: column.minWidth ?? 50,
                                            }}
                                        >
                                            {renderCellContent(column, row, rowIndex)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
