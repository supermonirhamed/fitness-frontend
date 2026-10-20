<script setup lang="ts">
// Adding a child to my account, or editing one (US-11.25): name, date of birth, gender, and on
// adding my relation and health notes (sent to the club, never shown back).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import FormField from '@/components/patterns/FormField.vue'
import { clientApi } from '@/api/clientApp'
import { fromYmd } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const app = useClientApp()
const id = route.params.id ? Number(route.params.id) : null
const loading = ref(!!id)
const busy = ref(false)
const errors = ref<ValidationErrors>({})
const form = ref({
  first_name: '',
  last_name: app.account?.client?.last_name ?? '',
  date_of_birth: null as Date | null,
  gender: null as 'female' | 'male' | null,
  relation: 'mother',
  health_notes: '',
})
const ymd = (d: Date | null) =>
  d
    ? [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        .map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
        .join('-')
    : null
const relations = computed(() =>
  ['mother', 'father', 'guardian', 'other'].map((r) => ({
    value: r,
    label: t(`app.family.relations.${r}`),
  })),
)
const genders = computed(() => [
  { value: 'female', label: t('app.family.genders.female') },
  { value: 'male', label: t('app.family.genders.male') },
])

onMounted(async () => {
  if (!id) return
  try {
    const c = await clientApi.family.get(id)
    form.value = {
      ...form.value,
      first_name: c.first_name,
      last_name: c.last_name,
      date_of_birth: fromYmd(c.date_of_birth),
      gender: c.gender,
    }
  } finally {
    loading.value = false
  }
})

async function save() {
  busy.value = true
  errors.value = {}
  const base = {
    first_name: form.value.first_name,
    last_name: form.value.last_name,
    date_of_birth: ymd(form.value.date_of_birth),
    gender: form.value.gender,
  }
  try {
    const child = id
      ? await clientApi.family.update(id, base)
      : await clientApi.family.add({
          ...base,
          relation: form.value.relation,
          health_notes: form.value.health_notes || null,
        })
    await app.check(true)
    await app.loadChildren(true)
    toast.add({ severity: 'success', summary: t('app.account.saved'), life: 2500 })
    await router.replace({ name: 'app.child', params: { id: child.id } })
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length)
      toast.add({
        severity: 'error',
        summary: firstMessage(e) ?? t('common.genericError'),
        life: 4000,
      })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ id ? t('app.family.edit') : t('app.family.add') }}</h1>
    <div v-if="loading" class="ca-card"><Skeleton height="240px" /></div>
    <form v-else class="ca-card ca-form" @submit.prevent="save">
      <FormField :label="t('app.family.firstName')" for="ch-first" :error="errors.first_name?.[0]">
        <InputText id="ch-first" v-model="form.first_name" required />
      </FormField>
      <FormField :label="t('app.family.lastName')" for="ch-last" :error="errors.last_name?.[0]">
        <InputText id="ch-last" v-model="form.last_name" required />
      </FormField>
      <FormField :label="t('app.family.birthDate')" for="ch-dob" :error="errors.date_of_birth?.[0]">
        <DatePicker
          v-model="form.date_of_birth"
          input-id="ch-dob"
          date-format="yy-mm-dd"
          :max-date="new Date()"
          show-icon
        />
      </FormField>
      <FormField :label="t('app.family.gender')" for="ch-gender" :error="errors.gender?.[0]">
        <Select
          v-model="form.gender"
          input-id="ch-gender"
          :options="genders"
          option-label="label"
          option-value="value"
          show-clear
        />
      </FormField>
      <template v-if="!id">
        <FormField :label="t('app.family.relation')" for="ch-rel" :error="errors.relation?.[0]">
          <Select
            v-model="form.relation"
            input-id="ch-rel"
            :options="relations"
            option-label="label"
            option-value="value"
          />
        </FormField>
        <FormField
          :label="t('app.family.healthNotes')"
          for="ch-health"
          :help="t('app.family.healthHint')"
          :error="errors.health_notes?.[0]"
        >
          <Textarea id="ch-health" v-model="form.health_notes" rows="3" auto-resize />
        </FormField>
      </template>
      <Button type="submit" :label="t('common.save')" :loading="busy" fluid />
    </form>
  </div>
</template>
