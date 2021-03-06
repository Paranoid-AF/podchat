import { createModel } from '@rematch/core'
import type { SourceResult } from '../../../../src-electron/extensions/child-process'
import { InvokeAction } from '../../../react-app-env'
import { RootModel } from './index'
import type {
  PayloadListSubscription,
  PayloadPinSubscription
} from '../../../../src-electron/ipc-main/handles/subscription'

import type {
  Subscription,
} from '../../../../src-electron/data/entity/Subscription'

import { store } from '../index'

interface PayloadFetchMore {
  page: number,
  setCurrentPage?: boolean,
}

const initState = {
  list: [] as Array<Subscription>,
  total: Number.MAX_VALUE,
  page: 1,
  allLoaded: false
}

let currentPage = 1
const itemsPerPage = 10

export const subscription = createModel<RootModel>()({
  state: {
    ...initState
  },
  reducers: {
    setPage(state: typeof initState, payload: number) {
      return {
        ...state,
        page: payload
      }
    },
    setPinState(state: typeof initState, payload: { uuid: string, state: boolean }) {
      const result = [...state.list]
      const target = result.find(item => (item.uuid === payload.uuid))
      if(target) {
        target.pinned = payload.state
      }
      return {
        ...state,
        list: result
      }
    },
    toggleAllLoaded(state: typeof initState, payload: boolean) {
      return {
        ...state,
        allLoaded: payload
      }
    },
    resetList(state: typeof initState) {
      return {
        ...state,
        list: [],
        total: Number.MAX_VALUE
      }
    },
    appendList(state: typeof initState, payload: {
      list: typeof initState['list'],
      total: typeof initState['total'],
    }) {
      return {
        ...state,
        list: [
          ...state.list,
          ...payload.list
        ],
        total: payload.total
      }
    },
    removeFromList(state: typeof initState, { uuid }: { uuid: string }) {
      const targetIndex = state.list.findIndex(item => (item.uuid === uuid))
      if(targetIndex >= 0) {
        const result = [...state.list]
        result.splice(targetIndex, 1)
        return {
          ...state,
          list: result
        }
      }
      return {
        ...state
      }
    },
  },
  effects: (dispatch: any) => ({
    async submitSourceForm (payload: { sourceId: string, formContent: Record<string, any>, provider?: string }) {
      const result = (await window.electron.invoke('extension', {
        type: 'submitSourceForm',
        payload: {
          id: payload.sourceId,
          content: payload.formContent,
          provider: payload.provider
        }
      } as InvokeAction))
      if(result.status === 'success') {
        const sourceResult = result.data as SourceResult
        const targetInfo = await (window.electron.invoke('subscription', {
          type: 'add',
          payload: {
            ...sourceResult,
            source: payload.sourceId,
            extension: payload.provider ?? ''
          }
        } as InvokeAction))
        if(targetInfo.status === 'success') {
          dispatch.subscription.toggleAllLoaded(false)
          /* Refetch all data */
          let pageAfterReset = 1
          dispatch.subscription.resetList();
          (function refetchAll() {
            if(pageAfterReset > currentPage + 1) {
              return
            }
            return new Promise((resolve) => {
              dispatch.subscription.fetchMore({ page: pageAfterReset, setCurrentPage: false })
                .then(() => {
                  pageAfterReset++
                  resolve('')
                })
            }).then(() => {
              refetchAll()
            })
          })()
          return targetInfo.data as Subscription
        } else {
          throw new Error(result.info ?? 'Error saving subscription.')
        }
      } else {
        throw new Error(result.info ?? 'Error saving subscription.')
      }
    },
    async fetchMore({ page, setCurrentPage }: PayloadFetchMore) {
      if(typeof setCurrentPage === 'undefined') {
        setCurrentPage = true
      }
      const result = await window.electron.invoke('subscription', {
        type: 'list',
        payload: {
          amount: itemsPerPage,
          page: page
        } as PayloadListSubscription
      } as InvokeAction)
      if(result.status === 'success') {
        if(result.data.list.length <= 0) {
          dispatch.subscription.toggleAllLoaded(true)
        }
        if(setCurrentPage) {
          currentPage = page
        }
        dispatch.subscription.appendList({
          list: result.data.list,
          total: result.data.total
        })
      } else {
        throw new Error(result.info)
      }
    },
    async pinSubscription({ uuid, operation }: { uuid: string, operation: 'pin' | 'unpin' }) {
      const result = await window.electron.invoke('subscription', {
        type: 'pin',
        payload: {
          operation: operation,
          uuid
        } as PayloadPinSubscription
      })
      if(result.status === 'success') {
        dispatch.subscription.setPinState({
          uuid,
          state: operation === 'pin'
        })
        dispatch.app.changeTabPinState({
          uuid,
          state: operation === 'pin'
        })
        if(operation === 'pin') {
          const targetItem = store.getState().subscription.list.find(item => (item.uuid === uuid))
          if(targetItem) {
            dispatch.app.insertTab({
              type: 'pinned',
              item: targetItem
            })
          }
        }
      }
    },
    async initPinnedTabs() {
      const result = await window.electron.invoke('subscription', {
        type: 'listPinned'
      })
      if(result.data) {
        result.data.forEach((item: Subscription) => {
          dispatch.app.insertTab({
            type: 'pinned',
            item: item
          })
        })
      }
    },
    async deleteSubscription({ uuid }: { uuid: string }) {
      /* Clean up tabs */
      const { tabs, tabIds } = store.getState().app
      if(tabIds.has(uuid)) {
        let targetIndex: number = -1
        let type: 'none' | 'pinned' | 'regular' = 'none'
        targetIndex = tabs.pinned.findIndex(item => (item.uuid === uuid))
        if(targetIndex >= 0) {
          type = 'pinned'
        } else {
          targetIndex = tabs.regular.findIndex(item => (item.uuid === uuid))
          if(targetIndex >= 0) {
            type = 'regular'
          }
        }
        if(type !== 'none') {
          dispatch.app.removeTab({
            type, 
            uuid
          })
        }
      }
      /* Remove from subscription list */
      dispatch.subscription.removeFromList({ uuid })
      await window.electron.invoke('subscription', {
        type: 'delete',
        payload: {
          uuid: uuid
        }
      })
    }
  })
})
