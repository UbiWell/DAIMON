export const removeLocalStorageItem = (key) => {
    try {
        localStorage.removeItem(key);
        console.log(`Removed "${key}" from localStorage`);
    } catch (err) {
        console.error(`Error removing "${key}" from localStorage`, err);
    }
};
