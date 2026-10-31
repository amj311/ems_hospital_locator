import { onMounted, ref } from 'vue'; // Using Vue's Composition API

/**
 * Custom hook to manage asynchronous loading state for a function.
 * @param {Function} asyncLoader - An async function that returns the data Promise.
 * @returns {{
 *   data: Ref<any>, 
 *   isLoading: Ref<boolean>, 
 *   error: Ref<Error|null>, 
 *   executeLoader: Function
 * }}
 */
export function useAsyncLoader(asyncLoader) {
    // --- State Management ---
    const data = ref(null);
    const isLoading = ref(true);
    const error = ref<Error | null>(null);

    /**
     * Executes the async loading process. This is the core logic.
     */
    const executeLoader = async () => {
        isLoading.value = true;
        error.value = null; // Clear previous errors
        data.value = null;   // Clear previous data

        try {
            // 1. Execute the provided asynchronous function
            const result = await asyncLoader(); 
            // 2. If successful, update state
            data.value = result;
        } catch (err) {
            // 3. If an error occurs, capture it in the state
            error.value = err instanceof Error ? err : new Error(String(err));
            console.error('❌ Load failed:', error.value);
            
        } finally {
            // 4. Always set loading to false when finished (success or failure)
            isLoading.value = false;
        }
    };

    // Automatically execute the loader when the component mounts
    onMounted(executeLoader); // Use a lifecycle hook like onMounted() in reality
    return { data, isLoading, error, executeLoader };
}
