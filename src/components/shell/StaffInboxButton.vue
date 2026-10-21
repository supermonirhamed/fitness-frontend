<script setup lang="ts">
// The staff user's in-app inbox (US-12.04): a bell with the unread count in the header; opening
// it lists the latest alerts and marks them read. Staff alerts (US-12.15) post here.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import OverlayBadge from 'primevue/overlaybadge'
import Popover from 'primevue/popover'
import { useRouter } from 'vue-router'
import { tenantApi, type StaffInboxItem } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffInboxText } from '@/composables/useStaffInboxText'

const { t } = useI18n()
const router = useRouter()
const text = useStaffInboxText()
const format = useFormat()
const items = ref<StaffInboxItem[]>([])
const unread = ref(0)
const loaded = ref(false)
const panel = ref<InstanceType<typeof Popover>>()
let timer: ReturnType<typeof setInterval> | undefined

async function refresh() {
  try {
    const res = await tenantApi.staffInbox.list()
    items.value = res.data
    unread.value = res.meta.unread
    loaded.value = true
  } catch {
    // The bell stays as it was; the next refresh tries again.
  }
}
onMounted(() => {
  refresh()
  timer = setInterval(refresh, 120_000)
})
onBeforeUnmount(() => clearInterval(timer))

async function toggle(event: Event) {
  panel.value?.toggle(event)
  await refresh()
  if (unread.value) unread.value = await tenantApi.staffInbox.read().catch(() => unread.value)
}
function open(item: StaffInboxItem) {
  if (typeof item.data.link !== 'string') return
  panel.value?.hide()
  router.push(item.data.link)
}
</script>

<template>
  <OverlayBadge v-if="unread" :value="unread > 99 ? '99+' : unread" severity="danger" size="small">
    <Button
      icon="pi pi-bell"
      variant="text"
      severity="secondary"
      rounded
      :aria-label="t('staffInbox.open', { n: unread })"
      @click="toggle"
    />
  </OverlayBadge>
  <Button
    v-else
    icon="pi pi-bell"
    variant="text"
    severity="secondary"
    rounded
    :aria-label="t('staffInbox.title')"
    @click="toggle"
  />
  <Popover ref="panel">
    <div class="inbox">
      <strong>{{ t('staffInbox.title') }}</strong>
      <p v-if="loaded && !items.length" class="muted small">{{ t('staffInbox.none') }}</p>
      <ul v-else>
        <li v-for="item in items" :key="item.id" :class="{ unread: !item.read }">
          <button
            v-if="typeof item.data.link === 'string'"
            type="button"
            class="link"
            @click="open(item)"
          >
            <i v-if="item.urgent" class="pi pi-exclamation-circle urgent" aria-hidden="true" />
            {{ text(item) }}
          </button>
          <span v-else>{{ text(item) }}</span>
          <span class="muted small">{{ item.at ? format.dateTime(item.at) : '' }}</span>
        </li>
      </ul>
    </div>
  </Popover>
</template>

<style scoped>
.inbox {
  width: min(340px, 80vw);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow: auto;
}
li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}
li.unread > :first-child {
  font-weight: 600;
}
.link {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.urgent {
  color: var(--sev-warn-solid);
  font-size: 12px;
}
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
</style>
