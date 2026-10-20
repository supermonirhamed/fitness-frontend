<script setup lang="ts">
// My family (US-11.25): the children I'm a guardian of — added by me or linked by staff — with
// what I may do for each. Adding a child gives me every permission; only staff remove a link.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import type { FamilyChild } from '@/api/clientApp'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const app = useClientApp()
const children = ref<FamilyChild[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  state.value = 'loading'
  try {
    await app.check(true)
    children.value = await app.loadChildren(true)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ca-stack">
    <div class="ca-spread">
      <h1 class="ca-title">{{ t('app.family.title') }}</h1>
      <RouterLink :to="{ name: 'app.child.new' }" custom v-slot="{ navigate }">
        <Button icon="pi pi-plus" :label="t('app.family.add')" size="small" @click="navigate" />
      </RouterLink>
    </div>
    <p class="ca-muted ca-small">{{ t('app.family.hint') }}</p>
    <RouterLink
      v-if="children.length && app.config?.features.online_academy_enrollment"
      :to="{ name: 'app.academy.enroll' }"
      custom
      v-slot="{ navigate }"
    >
      <Button
        icon="pi pi-flag"
        :label="t('app.academy.enrollTitle')"
        variant="outlined"
        fluid
        @click="navigate"
      />
    </RouterLink>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="96px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <EmptyState
      v-else-if="!children.length"
      icon="pi-users"
      :title="t('app.family.none')"
      :body="t('app.family.noneHint')"
    />
    <ul v-else class="ca-card ca-list">
      <li v-for="c in children" :key="c.id">
        <RouterLink :to="{ name: 'app.child', params: { id: c.id } }" class="ca-spread child">
          <span class="ca-row">
            <img v-if="c.photo_url" :src="c.photo_url" alt="" class="avatar" />
            <span v-else class="avatar avatar--initial" aria-hidden="true">{{
              c.first_name.charAt(0)
            }}</span>
            <span>
              <strong>{{ c.first_name }} {{ c.last_name }}</strong>
              <span class="ca-muted ca-small block">{{
                c.age !== null ? t('app.family.age', { n: c.age }, c.age) : c.member_id
              }}</span>
            </span>
          </span>
          <i class="pi pi-angle-right pi-dir" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.child {
  padding: 10px 0;
  color: var(--text-primary);
  text-decoration: none;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.avatar--initial {
  display: grid;
  place-items: center;
  background: var(--surface-100);
  font-weight: 600;
}
.block {
  display: block;
}
</style>
