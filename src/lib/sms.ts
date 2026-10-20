// How an SMS text is sent and billed (US-12.03), the same count as the server's SmsText: GSM-7 when
// every character is in the GSM alphabet (160, 153 per part; ^{}\[~]|€ count twice), otherwise
// UCS-2, as Arabic always is (70, 67 per part).
const GSM =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXTENDED = '^{}\\[~]|€'

export interface SmsCount {
  encoding: 'GSM-7' | 'UCS-2'
  characters: number
  segments: number
}

export function smsCount(text: string): SmsCount {
  let units = 0
  let gsm = true
  for (const char of Array.from(text)) {
    if (GSM_EXTENDED.includes(char)) units += 2
    else if (GSM.includes(char)) units += 1
    else {
      gsm = false
      break
    }
  }
  // UCS-2 counts UTF-16 code units (an emoji is two).
  if (!gsm) units = text.length
  const [single, part] = gsm ? [160, 153] : [70, 67]
  return {
    encoding: gsm ? 'GSM-7' : 'UCS-2',
    characters: units,
    segments: units <= single ? 1 : Math.ceil(units / part),
  }
}
