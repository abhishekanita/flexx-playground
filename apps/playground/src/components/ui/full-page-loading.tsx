import { Loader2 } from 'lucide-react';

const FullPageLoading = ({ debug, debugColor }: { debug?: string; debugColor?: string }) => {
    return (
        <div
            className="h-screen w-screen flex items-center justify-center flex-col"
            style={{ backgroundColor: debugColor }}
        >
            <Loader2 className="w-10 h-10 animate-spin" />
            {debug && <div className="text-xs mt-2 uppercase text-muted-foreground">{debug}</div>}
        </div>
    );
};

export default FullPageLoading;
