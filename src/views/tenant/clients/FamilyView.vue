<script setup lang="ts">
// The family page (US-05.10, brief 06 §4): guardians and children together, each with their
// upcoming bookings and what they still owe at the desk, and the family's combined balance.
// Children's programs and groups join with the Academy (MVP-3), memberships with EP-06.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type FamilyPage } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const route = useRoute()
const { t } = useI18n()
const format = useFormat()
const state = ref<'loading' | 'ready' | 'error'>('loading')
const page = ref<FamilyPage | null>(null)
const id = computed(() => Number(route.params.id))

async function load() {
  state.value = 'loading'
  try {
    page.value = await tenantApi.clients.familyPage(id.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
watch(id, load)

const guardians = computed(() => page.value?.members.filter((m) => m.role === 'guardian') ?? [])
const children = computed(() => page.value?.members.filter((m) => m.role === 'child') ?? [])
const self = computed(() => page.value?.members.find((m) => m.client.id === id.value))
const nameOf = (clientId: number) =>
  page.value?.members.find((m) => m.client.id === clientId)?.client.name
</script>

<template>
  <div class="page">
    <nav class="crumbs" :aria-label="t('shell.breadcrumb')">
      <RouterLink :to="{ name: 'tenant.clients' }">{{ t('clients.title') }}</RouterLink>
      <i class="pi pi-chevron-right pi-dir" aria-hidden="true" />
      <RouterLink :to="{ name: 'tenant.client', params: { id } }">{{
        self?.client.name
      }}</RouterLink>
      <i class="pi pi-chevron-right pi-dir" aria-hidden="true" />
      <span aria-current="page">{{ t('familyPage.title') }}</span>
    </nav>

    <Skeleton v-if="state === 'loading'" height="160px" />
    <ErrorState
      v-else-if="state === 'error' || !page"
      class="card"
      :title="t('family.loadError')"
      @retry="load"
    />
    <template v-else>
      <header class="head">
        <h1>{{ t('familyPage.titleOf', { name: self?.client.name }) }}</h1>
        <div v-if="page.owed > 0" class="owed">
          <span class="muted">{{ t('familyPage.owed') }}</span>
          <strong class="num">{{ format.money(page.owed) }}</strong>
        </div>
        <Tag
          v-else
          severity="success"
          class="tag-sm"
          icon="pi pi-check"
          :value="t('familyPage.nothingOwed')"
        />
      </header>
      <Message v-if="page.members.length === 1" severity="secondary" :closable="false">{{
        t('familyPage.alone')
      }}</Message>

      <section
        v-for="group in [
          { key: 'guardians', list: guardians },
          { key: 'dependents', list: children },
        ]"
        :key="group.key"
      >
        <h2 v-if="group.list.length" class="section">{{ t(`family.${group.key}`) }}</h2>
        <div class="grid">
          <article v-for="m in group.list" :key="m.client.id" class="card member">
            <RouterLink :to="{ name: 'tenant.client', params: { id: m.client.id } }" class="who">
              <PersonAvatar :name="m.client.name" :image="m.client.photo_url" size="lg" />
              <span>
                <span class="who__name">{{ m.client.name }}</span>
                <small class="muted">
                  {{ m.client.member_id }}
                  <template v-if="m.client.age !== null">
                    · {{ t('clients.age', { n: m.client.age }) }}</template
                  >
                </small>
              </span>
              <StatusTag :status="m.client.status" size="sm" />
            </RouterLink>
            <small v-if="m.guardians.length" class="muted">{{
              t('familyPage.guardiansOf', {
                names: m.guardians.map(nameOf).filter(Boolean).join(', '),
              })
            }}</small>
            <div class="block">
              <span class="block__title">{{ t('clientProfile.nextBookings') }}</span>
              <p v-if="!m.upcoming.length" class="muted">{{ t('clientProfile.noUpcoming') }}</p>
              <ul v-else class="rows">
                <li v-for="b in m.upcoming" :key="b.id">
                  <span class="num">{{ b.session?.local.date }} {{ b.session?.local.start }}</span>
                  <span class="grow">{{ b.session?.service }}</span>
                  <small v-if="b.payer" class="muted">{{
                    t('booking.paidBy', { name: b.payer.name })
                  }}</small>
                </li>
              </ul>
            </div>
            <div v-if="m.owed > 0" class="member__owed">
              <span>{{ t('familyPage.memberOwes') }}</span>
              <strong class="num">{{ format.money(m.owed) }}</strong>
            </div>
          </article>
        </div>
      </section>
      <small class="muted">{{ t('familyPage.later') }}</small>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.crumbs a {
  color: var(--text-link);
  text-decoration: none;
}
.crumbs i {
  font-size: 10px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.head h1 {
  margin: 0;
  font: var(--text-h1);
}
.owed {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.owed strong {
  font-size: 22px;
  color: var(--sev-warn-fg);
}
.section {
  font: var(--text-h3);
  margin: 8px 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.member {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}
.who > span {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.who__name {
  font: 600 15px var(--font-sans);
}
.block__title {
  font: 500 13px var(--font-sans);
  color: var(--text-secondary);
}
.rows {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rows li {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.grow {
  flex: 1;
}
.member__owed {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-sunken);
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
</style>
