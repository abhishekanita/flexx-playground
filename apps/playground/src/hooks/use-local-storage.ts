import { getItemFromLocalStorage, setItemToLocalStorage } from '@/utils/localstorage';
import { useState } from 'react';

type SetValue<T> = (value: T | ((val: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        const value = getItemFromLocalStorage(key);
        if (value === null) return initialValue;
        return value as T;
    });

    const setValue: SetValue<T> = value => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            setItemToLocalStorage(key, valueToStore);
        } catch (error) {
            console.log(error);
        }
    };

    return [storedValue, setValue];
}
