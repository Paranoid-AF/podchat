import { createModel } from '@rematch/core'
import type { SourceResult } from '../../../../src-electron/extensions/child-process'
import { InvokeAction } from '../../../react-app-env'
import { RootModel } from './index'
import type {
  PayloadListSubscription,
} from '../../../../src-electron/ipc-main/handles/subscription'

import type {
  Subscription,
} from '../../../../src-electron/data/entity/Subscription'

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
    }
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
    }
  })
})
