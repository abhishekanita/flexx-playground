export const getItemFromLocalStorage = (key: string): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const item = window.localStorage.getItem(key);
        const parsed = JSON.parse(item as any);
        if (parsed === undefined || parsed === null) {
            return null;
        }
        return parsed;
    } catch (error) {
        // console.log(error);
        return '';
    }
};

export const setItemToLocalStorage = (key: string, value: any): void => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.log(error);
    }
};
