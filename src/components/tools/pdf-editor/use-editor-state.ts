"use client"

import { useCallback, useMemo, useReducer } from "react"
import { normalizeRotation, type Annotation, type AnnotationMap, type EditorPage } from "@/lib/pdf/edit"

export interface DocState {
  pages: EditorPage[]
  annotations: AnnotationMap
}

interface State {
  doc: DocState
  past: DocState[]
}

type Action =
  | { type: "apply"; fn: (doc: DocState) => DocState; record: boolean; base?: DocState }
  | { type: "undo" }
  | { type: "reset"; doc: DocState }

const MAX_HISTORY = 60

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "apply": {
      const next = action.fn(state.doc)
      // A no-op change is ignored unless the caller hands us a base snapshot
      // (committing edits that were already applied without recording).
      if (next === state.doc && !(action.record && action.base)) return state
      if (action.base === next) return state
      if (!action.record) return { ...state, doc: next }
      return { doc: next, past: [...state.past, action.base ?? state.doc].slice(-MAX_HISTORY) }
    }
    case "undo": {
      if (!state.past.length) return state
      return { doc: state.past[state.past.length - 1], past: state.past.slice(0, -1) }
    }
    case "reset":
      return { doc: action.doc, past: [] }
  }
}

let counter = 0
export function uid(prefix = "id") {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 7)}`
}

export interface ApplyOptions {
  /** Add an undo step (default true). */
  record?: boolean
  /** Snapshot to push instead of the current state (for drags/edits that already mutated without recording). */
  base?: DocState
}

export function useEditorState(initial: DocState) {
  const [state, dispatch] = useReducer(reducer, { doc: initial, past: [] })

  const apply = useCallback((fn: (doc: DocState) => DocState, opts: ApplyOptions = {}) => {
    dispatch({ type: "apply", fn, record: opts.record ?? true, base: opts.base })
  }, [])

  const actions = useMemo(() => {
    const mapPage = (pageId: string, fn: (list: Annotation[]) => Annotation[]) => (doc: DocState) => ({
      ...doc,
      annotations: { ...doc.annotations, [pageId]: fn(doc.annotations[pageId] ?? []) },
    })
    return {
      apply,
      undo: () => dispatch({ type: "undo" }),
      reset: (doc: DocState) => dispatch({ type: "reset", doc }),
      /** Record an undo step for changes applied since `base` with `record: false`. */
      commit: (base: DocState) => apply((d) => d, { base }),
      addAnnotation: (pageId: string, a: Annotation) => apply(mapPage(pageId, (l) => [...l, a])),
      updateAnnotation: (pageId: string, id: string, patch: Partial<Annotation>, opts?: ApplyOptions) =>
        apply(
          mapPage(pageId, (l) => l.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a))),
          opts
        ),
      removeAnnotation: (pageId: string, id: string, opts?: ApplyOptions) =>
        apply(
          mapPage(pageId, (l) => l.filter((a) => a.id !== id)),
          opts
        ),
      rotatePage: (pageId: string, delta: number) =>
        apply((doc) => ({
          ...doc,
          pages: doc.pages.map((p) => (p.id === pageId ? { ...p, rotation: normalizeRotation(p.rotation + delta) } : p)),
        })),
      movePage: (from: number, to: number) =>
        apply((doc) => {
          if (from === to || to < 0 || to >= doc.pages.length) return doc
          const pages = [...doc.pages]
          const [p] = pages.splice(from, 1)
          pages.splice(to, 0, p)
          return { ...doc, pages }
        }),
      deletePage: (pageId: string) =>
        apply((doc) => (doc.pages.length <= 1 ? doc : { ...doc, pages: doc.pages.filter((p) => p.id !== pageId) })),
      restorePage: (page: EditorPage, index: number) =>
        apply((doc) => {
          if (doc.pages.some((p) => p.id === page.id)) return doc
          const pages = [...doc.pages]
          pages.splice(Math.min(index, pages.length), 0, page)
          return { ...doc, pages }
        }),
      duplicatePage: (pageId: string) => {
        const newId = uid("page")
        apply((doc) => {
          const idx = doc.pages.findIndex((p) => p.id === pageId)
          if (idx < 0) return doc
          const pages = [...doc.pages]
          pages.splice(idx + 1, 0, { ...doc.pages[idx], id: newId })
          const copies = (doc.annotations[pageId] ?? []).map((a) => ({ ...a, id: uid("ann") }))
          return { pages, annotations: { ...doc.annotations, [newId]: copies } }
        })
        return newId
      },
    }
  }, [apply])

  return { doc: state.doc, canUndo: state.past.length > 0, ...actions }
}

export type EditorActions = ReturnType<typeof useEditorState>
