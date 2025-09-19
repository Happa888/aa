
import React, { useEffect, useState, useRef } from 'react'
import { auth, provider } from './firebase'
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { CardPicker } from './components/CardPicker'
import { db } from './firestore'
import { ref, set, get, child } from 'firebase/database';
import { realtimeDb } from './firebaseRealtime';
// 仮のデュエマ代表カード名リスト
const CARD_NAME_LIST = [
  'ボルメテウス・ホワイト・ドラゴン',
  'バルガライゾウ',
  'アクア・サーファー',
  'デーモン・ハンド',
  '超次元リバイヴ・ホール',
  'ガイアール・カイザー',
  '龍素記号Srスペルサイクリカ',
  '勝利のリュウセイ・カイザー',
  '蒼き団長 ドギラゴン剣',
  '轟く侵略 レッドゾーン',
  '無双竜機ボルバルザーク',
  '光神龍スペル・デル・フィン',
  '聖霊王アルファディオス',
  '邪眼皇ロマノフI世',
  '超戦龍覇モルトNEXT',
  '龍覇M・A・S',
  '百族の長プチョヘンザ',
  '奇石ミクセル',
  '音精ラフルル',
  '絶対の楯騎士',
  'その他…',
]

type Card = {
  id: string
  name: string
  count: number
  memo?: string
}

type Box = {
  id: string
  name: string
  cards: Card[]
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}


export function App() {
  // boxesの初期値を空配列に
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newBoxName, setNewBoxName] = useState('');
  const [allCardNames, setAllCardNames] = useState<string[]>([]);

  // Realtime Database保存・読込
  const loadFromRealtimeDb = async (uid: string) => {
    try {
      const snapshot = await get(child(ref(realtimeDb), `users/${uid}/boxes`));
      if (snapshot.exists()) {
        setBoxes(snapshot.val());
      } else {
        // データがなければ空配列
        setBoxes([]);
      }
    } catch (e) {
      // 読込失敗時は何もしない
    }
  };

  const saveToRealtimeDb = async () => {
    if (!user) return;
    try {
      await set(ref(realtimeDb, `users/${user.uid}/boxes`), boxes);
      alert('クラウドに保存しました');
      // 保存後に即時読込してboxesを最新化
      await loadFromRealtimeDb(user.uid);
    } catch (e) {
      alert('保存に失敗しました');
    }
  };

  // 認証状態管理
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) {
        loadFromRealtimeDb(u.uid);
      } else {
        setBoxes([]);
      }
    });
    return () => unsub();
  }, []);

  // Googleログイン
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert('ログインに失敗しました');
    }
  };

  // ログアウト
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      alert('ログアウトに失敗しました');
    }
  };

  // 公開フォルダのJSONからカード名リストを読み込み（存在しない場合は仮リストにフォールバック）
  useEffect(() => {
    // キャッシュを使わず常に最新を取得
    fetch('/cardnames.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((names) => {
        if (Array.isArray(names) && names.length > 0) setAllCardNames(names)
        else setAllCardNames(CARD_NAME_LIST)
      })
      .catch(() => setAllCardNames(CARD_NAME_LIST))
  }, [])

  // 子コンポーネントが参照できるようwindowに配置
  useEffect(() => {
    const w = window as any
    w.__ALL_CARD_NAMES__ = allCardNames
  }, [allCardNames])


  // 箱追加
  const addBox = () => {
    if (!newBoxName.trim()) return;
    setBoxes([...boxes, { id: randomId(), name: newBoxName.trim(), cards: [] }]);
    setNewBoxName('');
  };


  // 箱削除
  const removeBox = (id: string) => {
    setBoxes(boxes.filter(b => b.id !== id));
  };


  // カード追加
  const addCard = (boxId: string, card: Omit<Card, 'id'>) => {
    setBoxes(boxes.map(b => b.id === boxId ? {
      ...b,
      cards: [...b.cards, { ...card, id: randomId() }],
    } : b));
  };


  // カード削除
  const removeCard = (boxId: string, cardId: string) => {
    setBoxes(boxes.map(b => b.id === boxId ? {
      ...b,
      cards: b.cards.filter(c => c.id !== cardId),
    } : b));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-24">
      <header className="py-6 px-4 border-b border-white/10 mb-6 sm:py-8 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">カード収納管理</h1>
          <p className="text-white/70 text-sm sm:text-base mt-1">デュエマ等のカードをどの箱に入れているか管理できます</p>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <img src={user.photoURL ?? ''} alt="user" className="w-8 h-8 rounded-full border border-white/20" />
              <span className="text-sm">{user.displayName ?? user.email}</span>
              <button className="px-3 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-sm" onClick={handleLogout}>ログアウト</button>
              <button className="ml-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm" onClick={saveToRealtimeDb}>クラウドに保存</button>
            </>
          ) : (
            <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold" onClick={handleLogin}>
              Googleでログイン
            </button>
          )}
        </div>
      </header>
      <main className="px-4 sm:px-8">
        {user ? (
          <>
            <section className="mb-8">
              <h2 className="font-semibold mb-2 text-base sm:text-lg">箱を追加</h2>
              <div className="flex gap-2 flex-col sm:flex-row">
                <input
                  className="rounded-lg px-3 py-3 sm:py-2 bg-white/10 border border-white/20 text-white w-full text-base sm:text-base"
                  placeholder="箱の名前 (例: サブデッキ/保管用など)"
                  value={newBoxName}
                  onChange={e => setNewBoxName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addBox() }}
                />
                <button
                  className="px-4 py-3 sm:py-2 rounded-lg bg-primary-600 hover:bg-primary-700 transition text-base sm:text-base active:scale-95"
                  onClick={addBox}
                  style={{ touchAction: 'manipulation' }}
                >追加</button>
              </div>
            </section>

            {boxes.length === 0 && (
              <div className="text-center text-white/60 py-12 text-base sm:text-lg">箱がありません。追加してください。</div>
            )}

            <div className="space-y-8">
              {boxes.map(box => (
                <BoxSection
                  key={box.id}
                  box={box}
                  onRemove={() => removeBox(box.id)}
                  onAddCard={card => addCard(box.id, card)}
                  onRemoveCard={cardId => removeCard(box.id, cardId)}
                  allNames={allCardNames}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-white/70 py-24 text-lg">ログインするとカード管理機能が使えます</div>
        )}
      </main>
    </div>
  )
}

function BoxSection({ box, onRemove, onAddCard, onRemoveCard, allNames }: {
  box: Box
  onRemove: () => void
  onAddCard: (card: Omit<Card, 'id'>) => void
  onRemoveCard: (cardId: string) => void
  allNames: string[]
}) {
  const [cardName, setCardName] = useState('')
  const [cardCount, setCardCount] = useState(1)
  const [cardMemo, setCardMemo] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // サジェスト候補（入力文字列を含む正式名称を部分一致で表示）
  // 日本語検索の表記ゆれ（ひらがな/カタカナ、全角/半角）に対応
  const normalizeJP = (s: string) => {
    const nk = s.normalize('NFKC')
    // カタカナ→ひらがな（Unicodeで0x60差）
    const hira = nk.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    return hira.toLowerCase()
  }
  const filtered = (() => {
    const q = cardName.trim()
    if (!q) return []
    const nq = normalizeJP(q)
    return allNames.filter(n => normalizeJP(n).includes(nq)).slice(0, 50)
  })()

  const handleAdd = () => {
    if (!cardName.trim() || cardCount < 1) return
    onAddCard({ name: cardName.trim(), count: cardCount, memo: cardMemo.trim() })
    setCardName('')
    setCardCount(1)
    setCardMemo('')
    setShowSuggest(false)
  }

  return (
    <section className="glass p-4 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">{box.name}</h3>
        <button className="text-xs text-red-400 hover:underline" onClick={onRemove}>箱を削除</button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap relative">
        <div className="w-32 relative">
          <input
            ref={inputRef}
            className="rounded-lg px-2 py-1 bg-white/10 border border-white/20 text-white w-full"
            placeholder="カード名"
            value={cardName}
            onChange={e => {
              setCardName(e.target.value)
              setShowSuggest(true)
            }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 100)}
            autoComplete="off"
          />
          <button
            type="button"
            className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full text-xs text-primary-300 hover:underline"
            onMouseDown={() => setPickerOpen(true)}
          >一覧</button>
          {showSuggest && filtered.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 bg-slate-800 border border-white/20 rounded-lg mt-1 max-h-40 overflow-auto shadow-lg">
              {filtered.map(name => (
                <li
                  key={name}
                  className="px-2 py-1 hover:bg-primary-600 cursor-pointer text-sm"
                  onMouseDown={() => {
                    setCardName(name)
                    setShowSuggest(false)
                    inputRef.current?.focus()
                  }}
                >{name}</li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="number"
          min={1}
          className="rounded-lg px-2 py-1 bg-white/10 border border-white/20 text-white w-16"
          placeholder="枚数"
          value={cardCount}
          onChange={e => setCardCount(Number(e.target.value))}
        />
        <input
          className="rounded-lg px-2 py-1 bg-white/10 border border-white/20 text-white flex-1"
          placeholder="メモ (任意)"
          value={cardMemo}
          onChange={e => setCardMemo(e.target.value)}
        />
        <button
          className="px-3 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 transition"
          onClick={handleAdd}
        >追加</button>
      </div>
      <CardPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(name) => setCardName(name)}
        allNames={allNames}
      />
      <ul className="divide-y divide-white/10">
        {box.cards.length === 0 && (
          <li className="text-white/50 py-2">カードがありません</li>
        )}
        {box.cards.map(card => (
          <li key={card.id} className="flex items-center gap-2 py-2">
            <span className="font-medium">{card.name}</span>
            <span className="text-xs text-white/60">×{card.count}</span>
            {card.memo && <span className="text-xs text-white/40 ml-2">{card.memo}</span>}
            <button
              className="ml-auto text-xs text-red-400 hover:underline"
              onClick={() => onRemoveCard(card.id)}
            >削除</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
