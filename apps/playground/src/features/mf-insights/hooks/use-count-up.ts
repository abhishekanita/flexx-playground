import { useEffect, useState } from 'react';

export function useCountUp(target: number, duration = 1200) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        const start = performance.now();
        const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(target * eased));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [target, duration]);
    return value;
}
