export type ActionableId =
    | 'switch_regular_to_direct'
    | 'elss_unlock_calendar'
    | 'tax_harvest_window'
    | 'consolidate_overlap'
    | 'revive_exit_dormant'
    | 'redirect_micro_holdings'
    | 'rebalance_after_drift'
    | 'add_best_performer_dip'
    | 'set_sip_increase_reminder';

export interface Actionable {
    id: ActionableId;
    title: string;
    description: string;
    relevanceScore: number; // 0-100
    condition: boolean;
    metadata: Record<string, any>;
}
