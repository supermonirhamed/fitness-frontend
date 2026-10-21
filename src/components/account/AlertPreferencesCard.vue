<script setup lang="ts">
// Profile → Alerts (US-12.15): how this staff user gets their alerts (email, in the app's bell),
// whether non-urgent ones come as one daily digest, and which alerts to get at all.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { tenantApi, type AlertPreferences } from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'

const { t } = useI18n()
const toast = useToast()
const prefs = ref<AlertPreferences | null>(null)
const saved = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const failed = ref(false)

function snapshot(p: AlertPreferences) {
  return JSON.stringify({
    email: p.email,
    in_app: p.in_app,
    digest: p.digest,
    off: [...p.off].sort(),
  })
}
onMounted(async () => {
  try {
    prefs.value = await tenantApi.staffInbox.preferences()
    saved.value = snapshot(prefs.value)
  } catch {
    failed.value = true
  }
})
const changed = computed(() => !!prefs.value && snapshot(prefs.value) !== saved.value)
const groups = computed(() =>
  (['coach', 'manager'] as const)
    .map((audience) => ({
      audience,
      kinds: (prefs.value?.kinds ?? []).filter((k) => k.audience === audience),
    }))
    .filter((g) => g.kinds.length),
)

function toggle(key: string, on: boolean) {
  if (!prefs.value) return
  prefs.value.off = on ? prefs.value.off.filter((k) => k !== key) : [...prefs.value.off, key]
}
async function save() {
  if (!prefs.value) return
  saving.value = true
  error.value = null
  try {
    const { email, in_app, digest, off } = prefs.value
    prefs.value = await tenantApi.staffInbox.updatePreferences({ email, in_app, digest, off })
    saved.value = snapshot(prefs.value)
    toast.add({ severity: 'success', summary: t('alertPreferences.saved'), life: 3000 })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="card" @submit.prevent="save">
    <div>
      <h2>{{ t('alertPreferences.title') }}</h2>
      <p class="muted">{{ t('alertPreferences.help') }}</p>
    </div>
    <Message v-if="failed" severity="error" :closable="false">{{
      t('alertPreferences.loadError')
    }}</Message>
    <Skeleton v-else-if="!prefs" height="160px" />
    <template v-else>
      <div class="rows">
        <label class="row">
          <span>
            <strong>{{ t('alertPreferences.email') }}</strong>
            <span class="muted">{{ t('alertPreferences.emailHelp') }}</span>
          </span>
          <ToggleSwitch v-model="prefs.email" :aria-label="t('alertPreferences.email')" />
        </label>
        <label class="row">
          <span>
            <strong>{{ t('alertPreferences.inApp') }}</strong>
            <span class="muted">{{ t('alertPreferences.inAppHelp') }}</span>
          </span>
          <ToggleSwitch v-model="prefs.in_app" :aria-label="t('alertPreferences.inApp')" />
        </label>
        <label class="row">
          <span>
            <strong>{{ t('alertPreferences.digest') }}</strong>
            <span class="muted">{{ t('alertPreferences.digestHelp') }}</span>
          </span>
          <ToggleSwitch
            v-model="prefs.digest"
            :disabled="!prefs.email"
            :aria-label="t('alertPreferences.digest')"
          />
        </label>
      </div>
      <fieldset v-for="g in groups" :key="g.audience" class="kinds">
        <legend>{{ t(`alertPreferences.audiences.${g.audience}`) }}</legend>
        <label v-for="k in g.kinds" :key="k.key" class="kind">
          <Checkbox
            :model-value="!prefs.off.includes(k.key)"
            binary
            :input-id="`alert-${k.key}`"
            @update:model-value="(v: boolean) => toggle(k.key, v)"
          />
          <span>{{ t(`alertPreferences.kinds.${k.key}`) }}</span>
          <Tag
            v-if="k.urgent"
            class="tag-sm"
            severity="warn"
            :value="t('alertPreferences.urgent')"
          />
        </label>
      </fieldset>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="actions">
        <Button
          type="submit"
          :label="t('permissions.save')"
          :disabled="!changed"
          :loading="saving"
        />
      </div>
    </template>
  </form>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
h2,
legend {
  margin: 0;
  padding: 0;
  font: var(--text-h3);
}
legend {
  font: var(--fw-semibold, 600) var(--fs-body, 14px) / 1.4 var(--font-sans);
  margin-bottom: var(--space-2);
}
.muted {
  margin: 0;
  display: block;
  font: var(--text-small);
  color: var(--text-secondary);
}
.rows {
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-subtle, var(--border-default));
  cursor: pointer;
}
.kinds {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.kind {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
