<script setup lang="ts">
import Icon from './utils/Icon.vue';
import type { ProfileDetails } from 'core/models/LocationShare.js';


const { size = 1 } = defineProps<{
	profile: ProfileDetails,
	border?: boolean,
	size?: number,
}>();

</script>

<template>
	<div>
		<div
			class="avatar square border-circle flex-center-all font-semibold"
			:class="[{ border: border && profile.icon }, profile.icon ? 'bg-white' : 'bg-blue-100']"
			:style="{ height: `${size}rem`, fontSize: `${size * 0.7}rem` }"
		>
			<Icon v-if="profile?.icon" :source_id="profile.icon" />
			<div v-else-if="profile.name">{{ profile.name[0].toUpperCase() }}</div>
			<Icon v-else name="material-symbols::person" />
		</div>
	</div>
</template>

<style scoped>
.avatar {
	user-select: none;
}
.border {
	border: 1px solid #0003;
}
</style>
