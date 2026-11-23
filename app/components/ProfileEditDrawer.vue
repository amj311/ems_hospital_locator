<script setup lang="ts">
import { useShareStore } from '@/stores/shares.store';
import { computed, ref, watch } from 'vue';
import DrawerModal from './utils/DrawerModal.vue';
import Icon from './utils/Icon.vue';
import Button from 'primevue/button';
import { emojis } from '@/utils/icons.js';
import type { HydratedShare, ProfileDetails } from '@core/models/LocationShare.js';
import { jsonCopy } from '@core/utils/miscUtils.js';
import EditProfile from './ProfileEditor.vue';
import { useUserStore } from '@/stores/user.store.js';

const drawerModal = ref<InstanceType<typeof DrawerModal> | null>(null);
const draft = ref<ProfileDetails>({} as ProfileDetails);

	defineExpose({
	open() {
		draft.value = jsonCopy(useUserStore().profile);
		drawerModal.value?.trigger()?.open();
	}
});

async function save() {
	await useUserStore().setDeviceProfile(draft.value);
	drawerModal.value?.trigger()?.close();
}

</script>

<template>
    <DrawerModal ref="drawerModal" width="28rem">
		<div class="flex-col-center align-items-stretch gap-2">
			<EditProfile v-model="draft" />
			<Button class="w-full" label="Save" @click="save" />
		</div>
	</DrawerModal>

</template>
<style scoped>
</style>
