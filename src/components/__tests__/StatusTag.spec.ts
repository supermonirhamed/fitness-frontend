import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { i18n, setLocale } from '@/i18n'
import StatusTag from '../patterns/StatusTag.vue'

const render = (status: string) =>
  mount(StatusTag, { props: { status }, global: { plugins: [PrimeVue, i18n] } })

describe('StatusTag', () => {
  it('maps each tenant status to one severity', () => {
    setLocale('en')
    expect(render('Active').find('.p-tag-success').text()).toBe('Active')
    expect(render('Provisioning').find('.p-tag-info').exists()).toBe(true)
    expect(render('Failed').find('.p-tag-danger').exists()).toBe(true)
    expect(render('Suspended').find('.p-tag-warn').exists()).toBe(true)
  })

  it('translates labels and switches direction', () => {
    setLocale('ar')
    expect(render('Active').text()).toBe('نشط')
    expect(document.documentElement.dir).toBe('rtl')
  })
})
