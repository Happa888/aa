import React, { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (name: string) => void
  allNames?: string[]
}

export function CardPicker({ open, onClose, onSelect, allNames = [] }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  // モーダル表示中に背面のスクロールを固定（モバイル対策）
  useEffect(() => {
    if (!open) return
    const { body } = document
    const prev = body.style.overflow
    body.style.overflow = 'hidden'
    return () => { body.style.overflow = prev }
  }, [open])

  // 入力のデバウンス（モバイルでのタイプ負荷軽減）
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 200)
    return () => clearTimeout(id)
  }, [q])

  const filtered = useMemo(() => {
    const normalizeJP = (s: string) => {
      const nk = s.normalize('NFKC')
      const hira = nk.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      return hira.toLowerCase()
    }
    const s = debouncedQ.trim()
    if (!s) return allNames.slice(0, 100)
    const nq = normalizeJP(s)
    return allNames.filter(n => normalizeJP(n).includes(nq)).slice(0, 200)
  }, [debouncedQ, allNames])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-slate-900">
          <h3 className="font-semibold">カード選択</h3>
          <button className="text-sm text-primary-300 hover:underline" onClick={onClose} aria-label="閉じる">閉じる</button>
        </div>
        <div className="p-3 sm:p-4">
          <input
            className="w-full rounded-lg px-3 py-3 sm:py-2 bg-white/10 border border-white/20 text-white text-base"
            placeholder="検索語を入力（例: ある）"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
            aria-label="カード検索"
          />
          <div ref={listRef} className="mt-3 sm:mt-4 h-[70vh] sm:h-80 overflow-auto space-y-2 pr-1 -mr-1">
            {filtered.length === 0 && (
              <div className="text-white/60 text-sm">該当するカードがありません</div>
            )}
            {filtered.map(name => (
              <button
                key={name}
                className="w-full text-left px-4 py-3 sm:py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-base"
                onClick={() => { onSelect(name); onClose() }}
              >{name}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
