<script setup lang="ts">
// Booking rules of a service (US-02.07): each setting inherits (from the organization or the
// picked branch) or is overridden for this service. Shows where each value comes from.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import BookingPolicyFields from '@/components/policies/BookingPolicyFields.vue'
import {
  tenantApi,
  type BookingPolicyOptions,
  type BookingPolicyOverrides,
  type PolicySource,
  type Service,
  type ServiceBookingPolicy,
} from '@/api/tenant'
import { validationErrors } from '@/lib/http'
import { toOverrides } from '@/lib/bookingPolicy'

const props = defineProps<{ service: Service | null; canEdit: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const toast = useToast()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const policy = ref<ServiceBookingPolicy | null>(null)
const options = ref<BookingPolicyOptions>({ penalties: [], waitlist_modes: [] })
const overrides = ref<BookingPolicyOverrides>(toOverrides())
const saved = ref('')
const locationId = ref<number | null>(null)
const saving = ref(false)
const errors = ref<Record<string, string[]>>({})
const formError = ref<string | null>(null)
const dirty = computed(() => JSON.stringify(overrides.value) !== saved.value)

const branchOptions = computed(() => [
  { value: null, label: t('serviceRules.anyBranch') },
  ...(props.service?.locations ?? []).map((l) => ({ value: l.location_id, label: l.name ?? '' })),
])

function apply(result: ServiceBookingPolicy) {
  policy.value = result
  overrides.value = toOverrides(result.overrides)
  saved.value = JSON.stringify(overrides.value)
}
async function load() {
  if (!props.service) return
  state.value = 'loading'
  try {
    const result = await tenantApi.bookingPolicy.forService(props.service.id, locationId.value)
    options.value = result.options
    apply(result.data)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(visible, (open) => {
  if (!open) return
  locationId.value = null
  errors.value = {}
  formError.value = null
  load()
})
watch(locationId, () => visible.value && load())

/** "Organization" or "Branch: Olaya" for each inherited setting. */
const sourceLabel = (source: PolicySource) =>
  source === 'location' && policy.value?.location
    ? t('serviceRules.fromBranch', { name: policy.value.location.name })
    : t('locationDetails.organizationLevel')
const inheritedSources = computed(() =>
  Object.fromEntries(
    Object.entries(policy.value?.inherited_sources ?? {}).map(([field, source]) => [
      field,
      sourceLabel(source),
    ]),
  ),
)

async function save() {
  if (!props.service) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    apply(
      await tenantApi.bookingPolicy.updateService(
        props.service.id,
        overrides.value,
        locationId.value,
      ),
    )
    toast.add({ severity: 'success', summary: t('serviceRules.saved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('bookingPolicy.checkFields')
      : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('serviceRules.title', { name: service?.display_name })"
    :style="{ width: '760px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="body">
      <p class="note">{{ t('serviceRules.intro') }}</p>
      <div class="branch">
        <label for="rules-branch">{{ t('serviceRules.showAt') }}</label>
        <Select
          v-model="locationId"
          input-id="rules-branch"
          :options="branchOptions"
          option-label="label"
          option-value="value"
          class="branch-select"
        />
      </div>

      <div v-if="state === 'loading'" class="stack">
        <Skeleton v-for="n in 3" :key="n" height="100px" />
      </div>
      <Message v-else-if="state === 'error'" severity="error" :closable="false">
        {{ t('bookingPolicy.loadError') }}
        <Button variant="link" size="small" :label="t('common.retry')" @click="load" />
      </Message>
      <template v-else-if="policy">
        <BookingPolicyFields
          v-model="overrides"
          :options="options"
          :inherited="policy.inherited"
          :inherited-sources="inheritedSources"
          :disabled="!canEdit"
          :errors="errors"
        />
        <Message v-if="formError" severity="error" :closable="false" role="alert">{{
          formError
        }}</Message>
      </template>
    </div>
    <template #footer>
      <span class="audit"
        ><i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}</span
      >
      <Button
        :label="t('common.close')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        v-if="canEdit"
        :label="t('permissions.save')"
        :disabled="!dirty || state !== 'ready'"
        :loading="saving"
        @click="save"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.note {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.branch {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.branch label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.branch-select {
  min-width: 220px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-inline-end: auto;
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
