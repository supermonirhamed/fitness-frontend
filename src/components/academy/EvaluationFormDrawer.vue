<script setup lang="ts">
// Evaluate one player (US-10.19): each criterion of the template on its scale, and an overall
// comment, and optionally the level the coach recommends for the next term (US-10.20). Saved as a
// draft for staff, or published to the guardians who can view performance. An evaluation saved on
// an older template version keeps that version's criteria.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  tenantApi,
  type EvaluationSection,
  type EvaluationSheet,
  type EvaluationValue,
  type ProgramLevel,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'

const props = defineProps<{
  groupId: number
  programId: number
  templateId: number
  period: string
  player: EvaluationSheet['players'][number] | null
  sections: EvaluationSection[]
  readonly?: boolean
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { t, locale } = useI18n()
const pick = (n: { ar?: string | null; en?: string | null }) =>
  locale.value === 'ar' ? n.ar || n.en : n.en || n.ar

const scores = ref<Record<string, EvaluationValue>>({})
const comment = ref('')
const recommendedLevelId = ref<number | null>(null)
const levels = ref<ProgramLevel[]>([])
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const shown = computed(() => props.player?.evaluation?.sections ?? props.sections)
const published = computed(() => props.player?.evaluation?.status === 'Published')
const scaleOptions = (scale: string) =>
  scale === 'levels'
    ? ['needs_improvement', 'good', 'excellent'].map((l) => ({
        value: l,
        label: t(`academy.evaluations.levels.${l}`),
      }))
    : Array.from({ length: scale === '1-5' ? 5 : 10 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
      }))

watch(visible, (open) => {
  if (!open) return
  scores.value = { ...props.player?.evaluation?.scores }
  comment.value = props.player?.evaluation?.comment ?? ''
  recommendedLevelId.value = props.player?.evaluation?.recommended_level_id ?? null
  errors.value = {}
  if (!levels.value.length) {
    tenantApi.academy.levels
      .list(props.programId)
      .then((all) => (levels.value = all.filter((l) => !l.archived)))
      .catch(() => null)
  }
  formError.value = null
})

async function save(publish: boolean) {
  if (!props.player) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    await tenantApi.academy.evaluations.save(props.groupId, {
      template_id: props.templateId,
      period: props.period,
      client_id: props.player.client.id,
      scores: scores.value,
      comment: comment.value.trim() || null,
      publish,
      recommended_level_id: recommendedLevelId.value,
    })
    emit('saved')
    visible.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value =
      Object.values(errors.value)[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="player?.client.name ?? ''"
    :subtitle="t('academy.evaluations.periodOf', { period: period })"
    size="lg"
    :saving="saving"
    :save-label="published ? t('common.save') : t('academy.evaluations.saveDraft')"
    :save-disabled="readonly"
    :error="formError"
    @save="save(false)"
  >
    <template v-if="!published && !readonly" #footer-start>
      <Button
        :label="t('academy.evaluations.publish')"
        icon="pi pi-send"
        severity="success"
        :loading="saving"
        @click="save(true)"
      />
    </template>
    <Message v-if="published" severity="success" :closable="false">{{
      t('academy.evaluations.publishedHint')
    }}</Message>
    <fieldset v-for="section in shown" :key="section.key" class="section">
      <legend>{{ pick(section.name) }}</legend>
      <FormField
        v-for="c in section.criteria"
        :key="c.key"
        :label="pick(c.name) ?? ''"
        :for="`crit-${c.key}`"
        :error="errors[`scores.${c.key}`]?.[0]"
      >
        <InputNumber
          v-if="c.scale === 'measure'"
          v-model="scores[c.key!] as number | null"
          :input-id="`crit-${c.key}`"
          :min="0"
          :max-fraction-digits="2"
          :suffix="c.unit ? ` ${c.unit}` : undefined"
          :disabled="readonly"
          fluid
        />
        <SelectButton
          v-else
          v-model="scores[c.key!]"
          :options="scaleOptions(c.scale)"
          option-label="label"
          option-value="value"
          :disabled="readonly"
          :aria-label="pick(c.name) ?? ''"
          class="scale"
        />
      </FormField>
    </fieldset>
    <FormField :label="t('academy.evaluations.comment')" for="eval-comment">
      <Textarea
        id="eval-comment"
        v-model="comment"
        rows="4"
        maxlength="5000"
        auto-resize
        :disabled="readonly"
        fluid
      />
    </FormField>
    <FormField
      v-if="levels.length"
      :label="t('academy.evaluations.recommendedLevel')"
      for="eval-level"
      :help="t('academy.evaluations.recommendedLevelHint')"
      :error="errors.recommended_level_id?.[0]"
    >
      <Select
        v-model="recommendedLevelId"
        input-id="eval-level"
        :options="levels"
        option-label="display_name"
        option-value="id"
        :placeholder="t('academy.evaluations.noRecommendation')"
        :disabled="readonly"
        show-clear
        fluid
      />
    </FormField>
  </FormDrawer>
</template>

<style scoped>
.section {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section legend {
  font-weight: 600;
  padding: 0 4px;
}
.scale {
  flex-wrap: wrap;
}
</style>
