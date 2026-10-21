<script setup lang="ts">
// The sandbox gateway's checkout (US-07.12): stands in for a provider's hosted payment page while
// no real gateway is connected. Test cards: 4242 4242 4242 4242 pays, 4000 0000 0000 0002 is
// declined, 4000 0000 0000 0341 pays but its saved card is declined later (US-07.13).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { csrfCookie, http } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { firstMessage } from '@/lib/apiErrors'

interface Checkout {
  organization: string
  amount: number
  currency: string
  status: string
  save_card: boolean
  test_cards: string[]
}
const { t } = useI18n()
const route = useRoute()
const format = useFormat()
const reference = String(route.params.reference)
const checkout = ref<Checkout | null>(null)
const card = ref('4242 4242 4242 4242')
const busy = ref(false)
const error = ref<string | null>(null)
const back = (cancelled = false) =>
  window.location.assign(`/app/payments?online=${reference}${cancelled ? '&cancelled=1' : ''}`)

onMounted(async () => {
  try {
    await csrfCookie()
    checkout.value = (await http.get(`/api/payments/sandbox/${reference}`)).data.data
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  }
})
async function pay() {
  busy.value = true
  error.value = null
  try {
    const result = (
      await http.post(`/api/payments/sandbox/${reference}/pay`, { card_number: card.value })
    ).data.data
    if (result.status === 'Succeeded' || result.status === 'Failed') back()
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="sandbox">
    <div class="card">
      <span class="badge">{{ t('sandboxCheckout.badge') }}</span>
      <Skeleton v-if="!checkout && !error" height="160px" />
      <template v-else-if="checkout">
        <h1>{{ checkout.organization }}</h1>
        <strong class="amount num">{{ format.money(checkout.amount) }}</strong>
        <p v-if="checkout.status !== 'Pending'" class="muted">
          {{ t('sandboxCheckout.done', { status: checkout.status }) }}
        </p>
        <form v-else class="form" @submit.prevent="pay">
          <label for="sandbox-card">{{ t('sandboxCheckout.card') }}</label>
          <InputText id="sandbox-card" v-model="card" dir="ltr" inputmode="numeric" fluid />
          <p class="muted small">
            {{ t('sandboxCheckout.cards') }}
            <code v-for="c in checkout.test_cards" :key="c" dir="ltr">{{ c }}</code>
          </p>
          <p v-if="checkout.save_card" class="muted small">{{ t('sandboxCheckout.saves') }}</p>
          <Button
            type="submit"
            :label="t('sandboxCheckout.pay', { amount: format.money(checkout.amount) })"
            :loading="busy"
            fluid
          />
          <Button
            :label="t('common.cancel')"
            variant="text"
            severity="secondary"
            fluid
            @click="back(true)"
          />
        </form>
      </template>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    </div>
  </main>
</template>

<style scoped>
.sandbox {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background: var(--surface-ground, var(--surface-page));
}
.card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
}
.badge {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--sev-warn-bg, #fef3c7);
  color: var(--sev-warn-fg, #92400e);
  font: 600 12px var(--font-sans);
}
h1 {
  margin: 0;
  font: 600 20px var(--font-sans);
}
.amount {
  font: 700 28px var(--font-sans);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.muted {
  margin: 0;
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
code {
  font-family: var(--font-mono);
  margin-inline-start: 6px;
}
</style>
