<script setup lang="ts">
import { useShareStore } from '@/stores/shares.store';
import { ref, watch } from 'vue';
import DrawerModal from './utils/DrawerModal.vue';
import type { HydratedShare } from '@core/models/LocationShare.js';
import { jsonCopy } from '@core/utils/miscUtils.js';
import EditProfile from './ProfileEditor.vue';
import Button from 'primevue/button';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);

const draft = ref<HydratedShare>({} as HydratedShare);

watch(() => useShareStore().editingShare, (share) => {
	if (share) {
		draft.value = jsonCopy(share);
		drawerModal.value?.trigger()?.open();
	}
});

</script>

<template>
    <DrawerModal ref="drawerModal" width="28rem" @close="useShareStore().cancelEditShare">
		<EditProfile v-model="draft.config.profile" />
		<Button label="Save" @click="async () => { await useShareStore().saveShare(draft); drawerModal?.trigger()?.close(); }" />
	</DrawerModal>

</template>
<style scoped>
</style>
