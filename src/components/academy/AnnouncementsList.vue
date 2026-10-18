<script setup lang="ts">
// Announcements sent, newest first (US-10.21): title, text, audience, channels, how many guardians
// it reached, who sent it and when.
import { useI18n } from 'vue-i18n'
import Tag from 'primevue/tag'
import type { AcademyAnnouncement } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

defineProps<{ announcements: AcademyAnnouncement[] }>()
const { t } = useI18n()
const format = useFormat()
const audienceOf = (a: AcademyAnnouncement) =>
  a.audience === 'program'
    ? a.program?.display_name
    : a.audience === 'age_group'
      ? a.age_group?.display_name
      : a.groups.map((g) => g.display_name).join('، ')
</script>

<template>
  <ul class="list">
    <li v-for="a in announcements" :key="a.id" class="item">
      <div class="item__head">
        <strong>{{ a.title }}</strong>
        <Tag
          v-for="c in a.channels"
          :key="c"
          severity="secondary"
          :value="t(`academy.announcements.channelNames.${c}`)"
        />
      </div>
      <p class="body">{{ a.body }}</p>
      <span class="muted small">
        {{ audienceOf(a) }} · {{ t('academy.announcements.reached', { n: a.recipients_count }) }} ·
        {{ a.author }} ·
        {{ a.created_at ? format.dateTime(a.created_at) : '' }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  padding: 12px 0;
  border-top: 1px solid var(--border-default);
}
.item:first-child {
  border-top: 0;
}
.item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.body {
  margin: 6px 0;
  white-space: pre-line;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
