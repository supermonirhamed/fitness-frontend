<script setup lang="ts">
// An announcement to guardians (US-10.21): to one or more groups, or — for academy admins — a whole
// program or age group; by email, SMS and/or push (sent by EP-12, respecting each guardian's
// notification choice). From a group's page it goes to that group.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  tenantApi,
  type AcademyAnnouncement,
  type AcademyGroup,
  type AgeGroup,
  type Program,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ group?: { id: number; display_name: string | null } | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [announcement: AcademyAnnouncement] }>()
const { t } = useI18n()
const auth = useStaffAuth()
const admin = computed(() => auth.can('academy.update'))

const audience = ref<AcademyAnnouncement['audience']>('groups')
const groupIds = ref<number[]>([])
const programId = ref<number | null>(null)
const ageGroupId = ref<number | null>(null)
const channels = ref<AcademyAnnouncement['channels']>(['email'])
const title = ref('')
const body = ref('')
const groups = ref<AcademyGroup[]>([])
const programs = ref<Program[]>([])
const ageGroups = ref<AgeGroup[]>([])
const saving = ref(false)
const error = ref<string | null>(null)

const audiences = computed(() =>
  (['groups', 'program', 'age_group'] as const).map((a) => ({
    value: a,
    label: t(`academy.announcements.audiences.${a}`),
  })),
)
const ownGroups = computed(() =>
  admin.value
    ? groups.value
    : groups.value.filter((g) => g.coaches?.some((c) => c.id === auth.user?.id)),
)
const ready = computed(
  () =>
    !!title.value.trim() &&
    !!body.value.trim() &&
    channels.value.length > 0 &&
    (audience.value === 'groups'
      ? groupIds.value.length > 0
      : audience.value === 'program'
        ? !!programId.value
        : !!ageGroupId.value),
)

watch(visible, async (open) => {
  if (!open) return
  audience.value = 'groups'
  groupIds.value = props.group ? [props.group.id] : []
  programId.value = null
  ageGroupId.value = null
  channels.value = ['email']
  title.value = ''
  body.value = ''
  error.value = null
  if (!props.group && !groups.value.length) {
    groups.value = await tenantApi.academy.groups.list().catch(() => [])
    if (admin.value && auth.can('services.view')) {
      programs.value = await tenantApi.programs.list().catch(() => [])
      const all = await Promise.all(
        programs.value.map((p) =>
          tenantApi.academy.ageGroups.list(p.id).catch(() => [] as AgeGroup[]),
        ),
      )
      ageGroups.value = [...new Map(all.flat().map((a) => [a.id, a])).values()]
    }
  }
})

function toggle(channel: AcademyAnnouncement['channels'][number], on: boolean) {
  channels.value = on ? [...channels.value, channel] : channels.value.filter((c) => c !== channel)
}

async function send() {
  saving.value = true
  error.value = null
  try {
    const sent = await tenantApi.academy.announcements.send({
      title: title.value.trim(),
      body: body.value.trim(),
      audience: audience.value,
      group_ids: audience.value === 'groups' ? groupIds.value : undefined,
      program_id: audience.value === 'program' ? programId.value : null,
      age_group_id: audience.value === 'age_group' ? ageGroupId.value : null,
      channels: channels.value,
    })
    emit('sent', sent)
    visible.value = false
  } catch (e) {
    error.value =
      Object.values(validationErrors(e))[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="t('academy.announcements.newTitle')"
    :subtitle="group?.display_name ?? undefined"
    :saving="saving"
    :save-label="t('academy.announcements.send')"
    :save-disabled="!ready"
    :error="error"
    @save="send"
  >
    <template v-if="!group">
      <FormField v-if="admin" :label="t('academy.announcements.audience')">
        <SelectButton
          v-model="audience"
          :options="audiences"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
      <FormField
        v-if="audience === 'groups'"
        :label="t('academy.announcements.groups')"
        for="ann-groups"
        required
      >
        <MultiSelect
          v-model="groupIds"
          input-id="ann-groups"
          :options="ownGroups"
          option-label="display_name"
          option-value="id"
          display="chip"
          filter
          fluid
        />
      </FormField>
      <FormField
        v-else-if="audience === 'program'"
        :label="t('academy.groups.program')"
        for="ann-program"
        required
      >
        <Select
          v-model="programId"
          input-id="ann-program"
          :options="programs"
          option-label="display_name"
          option-value="id"
          fluid
        />
      </FormField>
      <FormField v-else :label="t('academy.groups.ageGroup')" for="ann-age" required>
        <Select
          v-model="ageGroupId"
          input-id="ann-age"
          :options="ageGroups"
          option-label="display_name"
          option-value="id"
          fluid
        />
      </FormField>
    </template>
    <FormField :label="t('academy.announcements.title')" for="ann-title" required>
      <InputText id="ann-title" v-model="title" maxlength="150" fluid />
    </FormField>
    <FormField :label="t('academy.announcements.body')" for="ann-body" required>
      <Textarea id="ann-body" v-model="body" rows="6" maxlength="5000" auto-resize fluid />
    </FormField>
    <fieldset class="channels">
      <legend>{{ t('academy.announcements.channels') }}</legend>
      <label v-for="c in ['email', 'sms', 'push'] as const" :key="c" class="check">
        <Checkbox
          :model-value="channels.includes(c)"
          binary
          @update:model-value="(on: boolean) => toggle(c, on)"
        />
        <span>{{ t(`academy.announcements.channelNames.${c}`) }}</span>
      </label>
    </fieldset>
    <small class="muted">{{ t('academy.announcements.hint') }}</small>
  </FormDrawer>
</template>

<style scoped>
.channels {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.channels legend {
  font-weight: 600;
  margin-bottom: 6px;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-secondary);
}
</style>
