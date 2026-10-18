<script setup lang="ts">
// Search a client by name, member ID or mobile (for enrolling, the waiting list and trials).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import { tenantApi, type Client } from '@/api/tenant'

defineProps<{ inputId?: string; invalid?: boolean }>()
const picked = defineModel<{ id: number; name: string } | null>({ required: true })
const emit = defineEmits<{ picked: [client: Client] }>()
const { t } = useI18n()

const query = ref<string | Client>('')
const suggestions = ref<Client[]>([])
async function search(event: AutoCompleteCompleteEvent) {
  try {
    suggestions.value = (await tenantApi.clients.list({ q: event.query, per_page: 8 })).data
  } catch {
    suggestions.value = []
  }
}
function choose(client: Client) {
  picked.value = { id: client.id, name: client.name }
  emit('picked', client)
}
</script>

<template>
  <div v-if="picked" class="picked">
    <PersonAvatar :name="picked.name" />
    <span class="picked__name">{{ picked.name }}</span>
    <Button
      size="small"
      variant="text"
      icon="pi pi-times"
      :label="t('booking.change')"
      @click="((picked = null), (query = ''))"
    />
  </div>
  <AutoComplete
    v-else
    v-model="query"
    :input-id="inputId"
    :suggestions="suggestions"
    option-label="name"
    :placeholder="t('booking.search')"
    :min-length="2"
    :delay="250"
    :invalid="invalid"
    fluid
    @complete="search"
    @option-select="choose($event.value)"
  >
    <template #option="{ option }">
      <div class="option">
        <PersonAvatar :name="option.name" :image="option.photo_url" />
        <span class="option__text">
          <span>{{ option.name }}</span>
          <span class="option__sub" dir="ltr">{{
            [option.member_id, option.mobile].filter(Boolean).join(' · ')
          }}</span>
        </span>
      </div>
    </template>
    <template #empty>{{ t('booking.noResults') }}</template>
  </AutoComplete>
</template>

<style scoped>
.picked {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.picked__name {
  flex: 1;
  font-weight: 600;
}
.option {
  display: flex;
  align-items: center;
  gap: 10px;
}
.option__text {
  display: flex;
  flex-direction: column;
}
.option__sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
