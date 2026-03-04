import React from 'react';

const MainPanel = ({ children }: { children: React.ReactNode }) => {
    return <div className="h-full  relative ">{children}</div>;
};

export default MainPanel;
