<script setup lang="ts">
// Port of the design system's Avatar (data/Avatar.jsx): photo, or initials on a tone picked from the name.
import { computed } from 'vue'
import { avatarTone, initials } from '@/lib/avatar'

const SIZES = { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 } as const

const props = withDefaults(
  defineProps<{ name: string; image?: string | null; size?: keyof typeof SIZES }>(),
  { image: null, size: 'md' },
)
const px = computed(() => SIZES[props.size])
const tone = computed(() => avatarTone(props.name))
</script>

<template>
  <span
    class="person-avatar"
    role="img"
    :aria-label="name"
    :style="{
      width: `${px}px`,
      height: `${px}px`,
      fontSize: `${Math.round(px * 0.38)}px`,
      background: image ? `center/cover url(${image})` : `var(--${tone}-100)`,
      color: `var(--${tone}-700)`,
    }"
    ><template v-if="!image">{{ initials(name) }}</template></span
  >
</template>

<style scoped>
.person-avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 600;
  line-height: 1;
}
</style>
