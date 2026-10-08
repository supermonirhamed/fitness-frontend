import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { i18n, setLocale } from '@/i18n'
import OverrideDialog from '../patterns/OverrideDialog.vue'

describe('OverrideDialog', () => {
  it('requires a reason before confirming and emits it trimmed', async () => {
    setLocale('en')
    const wrapper = mount(OverrideDialog, {
      props: {
        visible: true,
        title: 'Suspend Elite Club?',
        confirmLabel: 'Suspend',
        destructive: true,
      },
      global: { plugins: [PrimeVue, i18n] },
      attachTo: document.body,
    })
    await nextTick()

    // PrimeVue Dialog portals to <body>.
    const confirm = () => document.body.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(confirm().disabled).toBe(true)

    const textarea = document.body.querySelector('textarea')!
    textarea.value = '  Unpaid invoice  '
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    expect(confirm().disabled).toBe(false)

    document.body.querySelector('form')!.dispatchEvent(new Event('submit'))
    expect(wrapper.emitted('confirm')).toEqual([['Unpaid invoice']])
    expect(document.body.textContent).toContain('This action is recorded in the audit log.')
    wrapper.unmount()
  })
})
