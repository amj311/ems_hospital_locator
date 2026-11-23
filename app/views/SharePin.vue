
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HydratedShare } from '@core/models/LocationShare';
import ProfileAvatar from '@/components/ProfileAvatar.vue';
import { useMapStore } from '@/stores/map.store';
import { onBeforeRouteUpdate, useRouter} from 'vue-router';

const props = defineProps<{
	share: HydratedShare,
}>();

const size = ref(3);
const avatarMargin = size.value * 0.05;
const avatarSize = size.value - (avatarMargin * 2);

const isSelected = computed(() => useMapStore().selectedShareDeviceId === props.share?.deviceId);

</script>

<template>
	<div class="share-pin-base" :class="{ isSelected }">
		<div class="share-pin-wrapper" :class="{ isSelected }" :style="{ width: size+'rem'}">
			<div class="avatar-wrapper" :style="{ width: avatarSize+'rem', top: avatarMargin+'rem'}">
				<ProfileAvatar :profile="share.config.profile" :size="avatarSize" />
			</div>
			<svg v-if="isSelected" xmlns="http://www.w3.org/2000/svg" style="width: 100%; aspect-ratio: 0.82;" viewBox="-51 -55 107 129">
				<path d="M1.849168,73.009403l37.5,-37.5c20.7,-20.7,20.7,-54.3,0,-75s-54.3,-20.7,-75,0s-20.7,54.3,0,75l37.5,37.5Z" fill="currentColor" />
			</svg>
		</div>
	</div>
</template>

<style scoped lang="scss">
.share-pin-base {
	// width and height match the leaflet marker width and height
	width: 12px;
	height: 12px;
	position: relative;
	filter: drop-shadow(0 0.05rem 0.1rem #0001);
}

.share-pin-wrapper {
	position: absolute;
	aspect-ratio: 1;
	top: 50%;
	left: 50%;
	translate: -50% -50%;
	transition: 200ms;

	&.isSelected {
		translate: -50% calc(-100% + 0.25rem);
	}

	.avatar-wrapper {
		position: absolute;
		top: var(--avatar-margin);
		left: 50%;
		translate: -50%,
	}

	svg {
		color: #fff;
	}

}
</style>