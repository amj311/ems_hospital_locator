<script setup lang="ts">
import { useShareStore } from '@/stores/shares.store';
import { computed, ref, watch } from 'vue';
import DrawerModal from './utils/DrawerModal.vue';
import Icon from './utils/Icon.vue';
import Button from 'primevue/button';
import { emojis } from '@/utils/icons.js';
import type { ProfileDetails } from '@core/models/LocationShare.js';
import { jsonCopy } from '@core/utils/miscUtils.js';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import ProfileAvatar from './ProfileAvatar.vue';


const value = defineModel<ProfileDetails | null | undefined>();
const draft = ref<ProfileDetails>(jsonCopy(value.value || {}));
watch(() => draft.value, () => {
	value.value = jsonCopy(draft.value || {});
}, { deep: true });

const emojiDrawer = ref<InstanceType<typeof DrawerModal> | null>(null);

function selectIcon(emoji: string | null) {
	draft.value.icon = emoji;
	emojiDrawer.value?.trigger()?.close();
}

const emojiSearch = ref('');

const numberPairs = [['1','one'], ['2','two'], ['3','three'], ['4','four'], ['5','five'], ['6','six'], ['7','seven'], ['8','eight']];
const preppedEmojis = Array.from(Object.values(emojis)).map(emoji => {
	let search = emoji.name;
	for (const [num, word] of numberPairs) {
		if (search.includes(num)) search.concat(word);
		if (search.includes(word)) search.concat(num);
	}
	return { ...emoji, search };
});

const filteredEmojis = computed(() => {
	const terms = emojiSearch.value.toLowerCase().split(/[^\w]/g);
	for (const [num, word] of numberPairs) {
		if (terms.includes(num)) terms.push(word);
		if (terms.includes(word)) terms.push(num);
	}

	return preppedEmojis.filter(emoji => {
		return terms.some(t => emoji.name.toLowerCase().includes(t));
	})
})

</script>

<template>
	<div class="flex-col-center gap-3 w-full">
		<div class="square relative cursor-pointer" @click="() => emojiDrawer?.trigger()?.open()">
			<ProfileAvatar :profile="draft" :size="5" border />
			<div class="bg-white square absolute w-3 border-round-2xl flex-center-all" style="border: 1px solid #0001; bottom: 0; right: 0;">
				<Icon name="material-symbols::edit" />
			</div>
		</div>
		<InputText fluid size="large" v-model="draft.name" placeholder="Name" class="text-center" />
	</div>

    <DrawerModal ref="emojiDrawer" title="Select icon" width="28rem" @close="useShareStore().cancelEditShare">
		<template #default>
			<div class="emoji-grid">
				<Button v-for="emoji in filteredEmojis" text class="text-3xl" :title="emoji.name" @click="() => selectIcon(emoji.emoji)"><Icon :source_id="emoji.emoji" /></Button>
			</div>
		</template>
		<template #footer>
			<div class="flex-row-center w-full">
				<div class="flex-row-center gap-2">
					<IconField>
						<InputIcon class="pi pi-search" />
						<InputText class="border-round-3xl" v-model="emojiSearch" />
					</IconField>
				</div>
				<div class="flex-1" />
				<Button icon="pi pi-times" severity="secondary" text label="Remove" @click="selectIcon(null)" />
			</div>
		</template>
    </DrawerModal>
</template>

<style scoped>
.emoji-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
}
</style>
