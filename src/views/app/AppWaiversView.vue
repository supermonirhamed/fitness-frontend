<script setup lang="ts">
// Waivers in the app (US-11.21): what the client and each child must sign, what is signed and
// when. Parents sign for their children. Opened after sign-up, from the home alerts, and when a
// booking needs a waiver; `redirect` brings the client back once all are signed.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type FamilyWaivers } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const format = useFormat()
const family = ref<FamilyWaivers[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const redirect = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : null,
)
const pending = computed(() =>
  family.value.flatMap((f) => f.waivers.filter((w) => w.state !== 'signed')),
)

async function load() {
  state.value = 'loading'
  try {
    family.value = await clientApi.waivers.family()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const sign = (templateId: number, clientId: number, self: boolean) =>
  router.push({
    name: 'app.waiver',
    params: { id: templateId },
    query: {
      ...(self ? {} : { client_id: clientId }),
      ...(redirect.value ? { redirect: redirect.value } : {}),
    },
  })
const done = () => router.replace(redirect.value ?? { name: 'app.home' })
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.waivers.title') }}</h1>
    <p class="ca-muted ca-small">{{ t('app.waivers.hint') }}</p>
    <template v-if="state === 'loading'">
      <div class="ca-card"><Skeleton height="72px" /></div>
    </template>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else>
      <EmptyState
        v-if="!family.some((f) => f.waivers.length)"
        icon="pi-file-check"
        :title="t('app.waivers.none')"
      />
      <section
        v-for="f in family.filter((x) => x.waivers.length)"
        :key="f.client.id"
        class="ca-card"
      >
        <h2 class="ca-subtitle">
          {{
            f.client.self
              ? t('app.waivers.mine')
              : t('app.waivers.for', { name: f.client.first_name })
          }}
        </h2>
        <ul class="ca-list">
          <li v-for="w in f.waivers" :key="w.template_id" class="ca-spread waiver">
            <div>
              <strong>{{ w.name }}</strong>
              <p v-if="w.required_for === 'services'" class="ca-muted ca-small">
                {{ t('app.waivers.forServices', { services: w.services.join('، ') }) }}
              </p>
              <p v-if="w.signed && w.state === 'signed'" class="ca-muted ca-small">
                {{
                  t('app.waivers.signedOn', {
                    date: format.dateTime(w.signed.signed_at),
                    name: w.signed.signer_name,
                  })
                }}
              </p>
            </div>
            <Tag v-if="w.state === 'signed'" severity="success" :value="t('app.waivers.signed')" />
            <Button
              v-else
              size="small"
              icon="pi pi-pencil"
              :label="w.state === 'resign' ? t('app.waivers.signAgain') : t('app.waivers.sign')"
              @click="sign(w.template_id, f.client.id, f.client.self)"
            />
          </li>
        </ul>
      </section>
      <Button
        v-if="redirect || route.query.welcome"
        :label="pending.length ? t('app.waivers.later') : t('app.waivers.continue')"
        :variant="pending.length ? 'text' : undefined"
        fluid
        @click="done"
      />
    </template>
  </div>
</template>

<style scoped>
.waiver {
  padding: 10px 0;
  gap: 12px;
}
</style>
