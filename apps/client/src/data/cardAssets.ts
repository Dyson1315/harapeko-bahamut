/**
 * カードIDと画像ファイル名のマッピング
 */
export const CARD_IMAGE_MAP: Record<string, string> = {
  'harapeko-bahamut': '01.harapekobahamuto.png',
  'kodomo-goblin': '02.kodomobahamuto.png',
  'hanekaeshi-goblin': '03.hanekaesigoburin.png',
  'soratobu-naifu': '04.soratobunaihu.png',
  'owakare': '05.owaka-re.png',
  'ideyon': '06.ideyoshi.png',
  'yomigaeru': '07.yomigae-ru.png',
  'irekaeru': '08.irekae-ru.png',
  'kuro-neko-shippo': '09.kuronekonoshippo.png',
  'gin-neko-shippo': '10.ginnekonoshippo.png',
  'karasu-otsukai': '11.karasunootsukai.png',
  'yousei-no-megane': '12.youseinomegane.png',
  'akuma-fukiya': '13.akumanohukiya.png',
  'hirameki-suishou': '14.hiramekisuisyou.png',
  'hoshifuru-sunadokei': '15.hoshihurusunadokei.png',
  'majo-no-otodokemono': '16.majonootodokemono.png',
};

/**
 * カードIDから画像パスを取得
 */
export function getCardImagePath(cardId: string): string | null {
  const filename = CARD_IMAGE_MAP[cardId];
  return filename ? `/cards/${filename}` : null;
}
