export const formatTimer = (timer: number) => {
    const hours = Math.floor(timer / 3600);
    const minutes = Math.floor(timer / 60);
    const seconds = Math.floor(timer % 60);
    const fn = (number: number) => (number > 9 ? number.toString() : `0${number}`);
    if (hours > 0) {
        return `${fn(hours)}:${fn(minutes)}:${fn(seconds)}`;
    } else return `${fn(minutes)}:${fn(seconds)}`;
};
