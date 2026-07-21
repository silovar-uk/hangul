const word = (id, hangul, reading, meaning, category, note = '') => ({
  id, type: 'word', hangul, reading, meaning, category, note
});

const phrase = (id, hangul, reading, meaning, category, note = '') => ({
  id, type: 'phrase', hangul, reading, meaning, category, note
});

export const WORDS = [
  word('hello-casual', '안녕', 'アンニョン', 'やあ／こんにちは', 'あいさつ', '親しい相手に使うカジュアルな表現。'),
  word('yes', '네', 'ネ', 'はい', 'あいさつ'),
  word('no', '아니요', 'アニヨ', 'いいえ', 'あいさつ'),
  word('thanks-short', '감사', 'カムサ', '感謝', 'あいさつ', '単独より「감사합니다」の形でよく使います。'),
  word('sorry', '미안해요', 'ミアネヨ', 'ごめんなさい', 'あいさつ'),
  word('person', '사람', 'サラム', '人', '人'),
  word('friend', '친구', 'チング', '友だち', '人'),
  word('family', '가족', 'カジョク', '家族', '人'),
  word('mother', '엄마', 'オンマ', 'お母さん', '人'),
  word('father', '아빠', 'アッパ', 'お父さん', '人'),
  word('water', '물', 'ムル', '水', '食べ物'),
  word('meal', '밥', 'パプ', 'ご飯／食事', '食べ物'),
  word('meat', '고기', 'コギ', '肉', '食べ物'),
  word('kimchi', '김치', 'キムチ', 'キムチ', '食べ物'),
  word('milk', '우유', 'ウユ', '牛乳', '食べ物'),
  word('coffee', '커피', 'コピ', 'コーヒー', '食べ物'),
  word('bread', '빵', 'パン', 'パン', '食べ物'),
  word('apple', '사과', 'サグァ', 'りんご', '食べ物'),
  word('home', '집', 'チプ', '家', '場所'),
  word('school', '학교', 'ハッキョ', '学校', '場所'),
  word('station', '역', 'ヨク', '駅', '場所'),
  word('shop', '가게', 'カゲ', '店', '場所'),
  word('toilet', '화장실', 'ファジャンシル', 'トイレ', '場所'),
  word('korea', '한국', 'ハングク', '韓国', '場所'),
  word('japan', '일본', 'イルボン', '日本', '場所'),
  word('today', '오늘', 'オヌル', '今日', '時間'),
  word('tomorrow', '내일', 'ネイル', '明日', '時間'),
  word('now', '지금', 'チグム', '今', '時間'),
  word('morning', '아침', 'アチム', '朝', '時間'),
  word('night', '밤', 'パム', '夜', '時間'),
  word('day', '하루', 'ハル', '一日', '時間'),
  word('go', '가요', 'カヨ', '行きます', '動作'),
  word('come', '와요', 'ワヨ', '来ます', '動作'),
  word('eat', '먹어요', 'モゴヨ', '食べます', '動作'),
  word('drink', '마셔요', 'マショヨ', '飲みます', '動作'),
  word('see', '봐요', 'パヨ', '見ます', '動作'),
  word('like', '좋아해요', 'チョアヘヨ', '好きです', '気持ち'),
  word('good', '좋아요', 'チョアヨ', '良いです／好きです', '気持ち'),
  word('okay', '괜찮아요', 'クェンチャナヨ', '大丈夫です', '気持ち'),
  word('delicious', '맛있어요', 'マシッソヨ', 'おいしいです', '気持ち'),
  word('spicy', '매워요', 'メウォヨ', '辛いです', '気持ち'),
  word('soccer', '축구', 'チュック', 'サッカー', 'サッカー'),
  word('player', '선수', 'ソンス', '選手', 'サッカー'),
  word('match', '경기', 'キョンギ', '試合', 'サッカー'),
  word('support', '응원', 'ウンウォン', '応援', 'サッカー'),
  word('victory', '승리', 'スンニ', '勝利', 'サッカー')
];

export const PHRASES = [
  phrase('hello-polite', '안녕하세요', 'アンニョンハセヨ', 'こんにちは', 'あいさつ'),
  phrase('thank-you', '감사합니다', 'カムサハムニダ', 'ありがとうございます', 'あいさつ'),
  phrase('excuse-me', '죄송합니다', 'チェソンハムニダ', 'すみません', 'あいさつ'),
  phrase('nice-to-meet', '만나서 반가워요', 'マンナソ パンガウォヨ', 'お会いできてうれしいです', 'あいさつ'),
  phrase('yes-right', '네, 맞아요', 'ネ、マジャヨ', 'はい、そうです', 'あいさつ'),
  phrase('im-okay', '괜찮아요', 'クェンチャナヨ', '大丈夫です', 'あいさつ'),
  phrase('this-please', '이거 주세요', 'イゴ ジュセヨ', 'これをください', '買い物・移動'),
  phrase('how-much', '얼마예요?', 'オルマエヨ？', 'いくらですか', '買い物・移動'),
  phrase('toilet-where', '화장실이 어디예요?', 'ファジャンシリ オディエヨ？', 'トイレはどこですか', '買い物・移動', 'パッチムと次の母音がつながって聞こえることがあります。'),
  phrase('station-where', '역이 어디예요?', 'ヨギ オディエヨ？', '駅はどこですか', '買い物・移動', '「역이」は音がつながり「ヨギ」に近く聞こえます。'),
  phrase('help-please', '도와주세요', 'トワジュセヨ', '助けてください', '買い物・移動'),
  phrase('photo-okay', '사진 찍어도 돼요?', 'サジン チゴド トェヨ？', '写真を撮ってもいいですか', '買い物・移動'),
  phrase('water-please', '물 주세요', 'ムル ジュセヨ', '水をください', '食事'),
  phrase('before-meal', '잘 먹겠습니다', 'チャル モッケッスムニダ', 'いただきます', '食事'),
  phrase('after-meal', '잘 먹었습니다', 'チャル モゴッスムニダ', 'ごちそうさまでした', '食事'),
  phrase('delicious-phrase', '맛있어요', 'マシッソヨ', 'おいしいです', '食事'),
  phrase('spicy-phrase', '매워요', 'メウォヨ', '辛いです', '食事'),
  phrase('slowly-please', '천천히 말해 주세요', 'チョンチョニ マレ ジュセヨ', 'ゆっくり話してください', '会話'),
  phrase('say-again', '다시 말해 주세요', 'タシ マレ ジュセヨ', 'もう一度言ってください', '会話'),
  phrase('korean-not-well', '한국어를 잘 못해요', 'ハングゴルル チャル モテヨ', '韓国語があまり話せません', '会話'),
  phrase('japanese-person', '저는 일본 사람이에요', 'チョヌン イルボン サラミエヨ', '私は日本人です', '会話'),
  phrase('understand', '알겠어요', 'アルゲッソヨ', '分かりました', '会話'),
  phrase('like-phrase', '좋아해요', 'チョアヘヨ', '好きです', '気持ち・応援'),
  phrase('miss-you', '보고 싶어요', 'ポゴ シポヨ', '会いたいです', '気持ち・応援'),
  phrase('cheer-up', '힘내세요', 'ヒムネセヨ', '頑張ってください', '気持ち・応援'),
  phrase('will-cheer', '응원할게요', 'ウンウォナルケヨ', '応援します', '気持ち・応援'),
  phrase('please-win', '이겨 주세요', 'イギョ ジュセヨ', '勝ってください', '気持ち・応援')
];

export const ALL_LEXICON = [...WORDS, ...PHRASES];

export const CONTENT_TYPES = {
  word: {
    label: '単語',
    pluralLabel: '単語',
    items: WORDS
  },
  phrase: {
    label: 'フレーズ',
    pluralLabel: 'フレーズ',
    items: PHRASES
  }
};

export function getLexiconItems(type = 'word') {
  return CONTENT_TYPES[type]?.items ?? WORDS;
}

export function getCategories(type = 'word') {
  return [...new Set(getLexiconItems(type).map((item) => item.category))];
}
