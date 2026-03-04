import MainPanelHeader from '@/features/dashboard/components/panels/main-panel-header';
import Panels from '@/features/dashboard/components/panels/panels';
import { Blocks } from 'lucide-react';
import { IntegrationsList } from '../components/integrations-list';

export const IntegrationsPage = () => {
    return (
        <Panels>
            <MainPanelHeader
                breadcrumbs={[{ label: 'Integrations', icon: <Blocks className="size-3.5" /> }]}
            />
            <div className="h-full overflow-auto">
                <div className="mx-auto max-w-3xl px-8 pt-10 pb-20">
                    <div className="space-y-1 mb-8">
                        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
                        <p className="text-sm text-muted-foreground">
                            Connect external services to streamline your workflow.
                        </p>
                    </div>
                    <IntegrationsList />
                </div>
            </div>
        </Panels>
    );
};
