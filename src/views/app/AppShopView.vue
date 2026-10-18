<script setup lang="ts">
// The shop (US-11.13): memberships and packages sold online, with price, what's included,
// validity and where they can be used. Intro offers show only to clients who may buy them.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type ShopProduct } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { productSummary } from '@/lib/clientApp'

const { t } = useI18n()
const format = useFormat()
const products = ref<ShopProduct[]>([])
const state = ref<'loading' | 'ready' | 'error' | 'closed'>('loading')
const from = (p: ShopProduct) => {
  const prices = p.prices.map((x) => x.price).filter((x): x is number => x !== null)
  return prices.length ? Math.min(...prices) : null
}

async function load() {
  state.value = 'loading'
  try {
    products.value = await clientApi.shop.list()
    state.value = 'ready'
  } catch (e) {
    state.value =
      (e as { response?: { status?: number } }).response?.status === 403 ? 'closed' : 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ca-stack">
    <RouterLink :to="{ name: 'app.account' }" class="ca-small back"
      ><i class="pi pi-arrow-left pi-dir" aria-hidden="true" />
      {{ t('app.nav.account') }}</RouterLink
    >
    <h1 class="ca-title">{{ t('app.shop.title') }}</h1>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="100px" /></div>
    <div v-else-if="state === 'closed'" class="ca-card">
      <EmptyState compact icon="pi-shopping-bag" :title="t('app.shop.closed')" />
    </div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <div v-else-if="!products.length" class="ca-card">
      <EmptyState compact icon="pi-shopping-bag" :title="t('app.shop.none')" />
    </div>
    <ul v-else class="ca-stack plain">
      <li v-for="p in products" :key="p.id" class="ca-card product">
        <div class="ca-spread">
          <strong>{{ p.name }}</strong>
          <Tag v-if="p.intro_offer" severity="success" :value="t('app.home.offer')" />
        </div>
        <p class="ca-small">{{ productSummary(t, p) }}</p>
        <p class="ca-muted ca-small">
          {{
            p.covers.all_services
              ? t('app.shop.allClasses')
              : [...p.covers.categories, ...p.covers.services, ...p.covers.programs].join(', ')
          }}
          ·
          {{
            p.covers.locations.length ? p.covers.locations.join(', ') : t('app.shop.allBranches')
          }}
        </p>
        <div class="ca-spread">
          <span v-if="from(p) !== null">
            <span v-if="p.prices.length > 1" class="ca-muted ca-small"
              >{{ t('app.shop.from') }}
            </span>
            <strong class="ca-num">{{
              from(p) === 0 ? t('app.price.free') : format.money(from(p)!)
            }}</strong>
          </span>
          <RouterLink
            :to="{ name: 'app.checkout', params: { id: p.id } }"
            custom
            v-slot="{ navigate }"
          >
            <Button :label="t('app.shop.buy')" size="small" @click="navigate" />
          </RouterLink>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.back {
  color: var(--text-secondary);
  text-decoration: none;
}
.plain {
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}
.product {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.product p {
  margin: 0;
}
</style>
