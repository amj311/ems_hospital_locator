<script setup lang="ts" generic="T">
import { useAsyncLoader } from './useAsyncLoader'; // Adjust path as needed

// Define props for optional text customization
const { showSpinner = true, load } = defineProps<{
    load: () => Promise<T>,
    loadingText?: String, // Fallback for loading message prop
    errorText?: String,      // Fallback for error message prop
	showSpinner?: boolean,
}>();

// Use the composable hook and destructure the state/controls
const { data, isLoading, error, executeLoader } = useAsyncLoader(load); 
</script>

<template>
  <div class="async-loader">
    
    <!-- Loading State -->
    <div v-if="isLoading" :class="['status-block', 'loading']">
      <!-- Prefer slot content if provided, otherwise use prop text -->
     	 <slot name="loading">
			<div class="flex-row-center">
				<template v-if="showSpinner">
					<i class="pi pi-spin pi-spinner" />
				</template>
				<template v-if="loadingText">
					{{ loadingText }}
				</template>
			</div>
		</slot>
    </div>

    <!-- Error/Fallback State -->
    <div v-else-if="error" :class="['status-block', 'error']">
       <!-- Use the designated error slot content -->
      <slot name="error">
        {{ errorText }}
      </slot>
    </div>

    <!-- Success State (The Final Content) -->
    <div v-else-if="data" :class="['status-block', 'success']">
      <slot name="default" :data="data">{{ data }}</slot>
    </div>

  </div>
</template>

<style scoped>
</style>
