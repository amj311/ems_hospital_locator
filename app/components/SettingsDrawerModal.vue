<script setup lang="ts">
import { ref } from 'vue';
import DrawerModal from './utils/DrawerModal.vue';
import { useSettingsStore } from '@/stores/settings.store';
import RadioButton from 'primevue/radiobutton';
import Button from 'primevue/button';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);
const settingsStore = useSettingsStore();

// Local binding to avoid immediately updating settings during interaction
const selectedProvider = ref(settingsStore.localSettings.mapsProvider);

function handleSave() {
	settingsStore.localSettings.mapsProvider = selectedProvider.value;
	drawerModal.value?.trigger()?.close();
}

function handleCancel() {
	selectedProvider.value = settingsStore.localSettings.mapsProvider;
	drawerModal.value?.trigger()?.close();
}

function open() {
	selectedProvider.value = settingsStore.localSettings.mapsProvider;
	drawerModal.value?.trigger()?.open();
}

defineExpose({ open });
</script>

<template>
	<DrawerModal ref="drawerModal" title="Settings" width="28rem">
		<div class="settings-container flex flex-column gap-4">
			<div class="maps-provider-section">
				<h3 class="settings-section-title">Navigation service</h3>
				<div class="flex flex-column gap-3 ml-2">
					<div class="flex align-items-center">
						<RadioButton
							v-model="selectedProvider"
							input-id="provider-system"
							value="system"
						/>
						<label for="provider-system" class="ml-2">System Default</label>
					</div>
					<div class="flex align-items-center">
						<RadioButton
							v-model="selectedProvider"
							input-id="provider-apple"
							value="apple"
						/>
						<label for="provider-apple" class="ml-2">Apple Maps</label>
					</div>
					<div class="flex align-items-center">
						<RadioButton
							v-model="selectedProvider"
							input-id="provider-google"
							value="google"
						/>
						<label for="provider-google" class="ml-2">Google Maps</label>
					</div>
				</div>
			</div>

			<div class="flex gap-2 justify-content-end">
				<Button
					label="Cancel"
					severity="secondary"
					@click="handleCancel"
				/>
				<Button
					label="Save"
					@click="handleSave"
				/>
			</div>
		</div>
	</DrawerModal>
</template>

<style scoped>
.settings-container {
	padding: 1rem 0;
}

.settings-section-title {
	margin: 0;
	font-size: 0.95rem;
	font-weight: 600;
	color: #333;
}
</style>
