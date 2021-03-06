import type { IpcMainInvokeEvent } from 'electron'
import { connection } from '../../../data'
import { Subscription } from '../../../data/entity/Subscription'
import type { SourceResult } from '../../../extensions/child-process'
import { v4 as uuid } from 'uuid'

interface SubscriptionAction {
  type: string,
  payload?: any
}

export interface PayloadSaveSubscription extends SourceResult {
  uuid: string,
  source: string,
  extension: string,
}

export interface PayloadListSubscription {
  page?: number, // Starts with 1
  amount?: number,
}

export interface PayloadPinSubscription {
  uuid: string,
  operation: 'pin' | 'unpin'
}

export interface PayloadDeleteSubscription {
  uuid: string
}

export interface PayloadSwapPinTab {
  newOrderUUIDs: Array<string>
}

export const subscription = async (event: IpcMainInvokeEvent, action: SubscriptionAction) => {
  const repo = connection.current?.getRepository(Subscription)
  if(!repo) {
    return {
      status: 'error',
      info: 'Error opening database.'
    }
  }
  switch(action.type) {
    case 'add': {
      try {
        const payload = action.payload as PayloadSaveSubscription
        const subInfo = new Subscription()
        const currentUUID = uuid()
        subInfo.uuid = currentUUID
        subInfo.source = payload.source
        subInfo.extension = payload.extension
        subInfo.title = payload.title
        subInfo.params = JSON.stringify(payload.params)
        if(payload.description) {
          subInfo.description = payload.description
        }
        if(payload.coverPic) {
          subInfo.cover_pic = payload.coverPic
        }
        if(payload.coverColor) {
          subInfo.cover_color = payload.coverColor
        }
        if(payload.additionalInfo) {
          subInfo.additional_info = JSON.stringify({ value: payload.additionalInfo })
        }
        await repo.save(subInfo)
        return {
          status: 'success',
          data: subInfo
        }
      } catch(err) {
        return {
          status: 'error',
          info: 'Error saving subscription into database.'
        }
      }
    }
    case 'list': {
      try {
        const payload = action.payload as PayloadListSubscription
        const amount = payload.amount ?? 10
        const page = payload.page ?? 1
        const result = await repo.findAndCount({
          take: amount,
          skip: (page - 1) * amount
        })
        return {
          status: 'success',
          data: {
            list: result[0],
            total: result[1]
          }
        }
      } catch(err) {
        return {
          status: 'error',
          info: 'Error fetching data from database'
        }
      }
    }
    case 'listPinned': {
      try {
        const result = await repo.find({
          where: {
            pinned: true
          },
          order: {
            pin_order: 'ASC'
          }
        })
        return {
          status: 'success',
          data: result
        }
      } catch(err) {
        return {
          status: 'error',
          info: 'Unable to fetch all pinned subscriptions'
        }
      }
    }
    case 'pin': {
      try {
        const payload = action.payload as PayloadPinSubscription
        const target = await repo.findOne({
          where: {
            uuid: payload.uuid
          }
        })
        if(!target) {
          return {
            status: 'error',
            info: 'No matched subscription.'
          }
        }
        if(payload.operation === 'pin') {
          target.pinned = true
          const lastMaxPinOrder = (
            await repo.createQueryBuilder()
              .select(`MAX(pin_order) as current`)
              .where(`pinned = true`)
              .getRawOne()
          )
          target.pin_order = lastMaxPinOrder.current + 1
        }
        if(payload.operation === 'unpin') {
          target.pinned = false
          target.pin_order = undefined
        }
        await repo.save(target)
        return {
          status: 'success'
        }
      } catch(err) {
        return {
          status: 'error',
          info: 'Error saving pin state'
        }
      }
    }
    case 'delete': {
      const payload = action.payload as PayloadDeleteSubscription
      const target = await repo.findOne({
        where: {
          uuid: payload.uuid
        }
      })
      if(target) {
        await repo.remove(target)
        return {
          status: 'success'
        }
      } else {
        return {
          status: 'error',
          info: 'No matching entity.'
        }
      }
    }
    case 'swapPinOrder': {
      const payload = action.payload as PayloadSwapPinTab
      const indexMap = new Map()
      const records = await repo.createQueryBuilder()
        .where(`pinned = true`)
        .andWhere(`uuid IN (:...uuids)`, { uuids: payload.newOrderUUIDs })
        .getMany()
      payload.newOrderUUIDs.forEach((id, index) => {
        indexMap.set(id, index)
      })
      records.forEach(item => {
        if(indexMap.has(item.uuid)) {
          item.pin_order = indexMap.get(item.uuid)
        }
      })
      await repo.save(records)
    }
  }
}