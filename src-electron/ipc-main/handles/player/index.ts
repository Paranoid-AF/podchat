import { screen } from 'electron'
import { sendMessage } from './sendMessage'
import playerWindow from '../../../windows/player'
import { EventTypes } from './enums'

const windowMargin = 50

interface ExtensionPayload {
  action: string,
  payload?: any
}

interface PlayerProps {
  url: string,
  playing: boolean,
  loop: boolean,
  volume?: number | null,
  muted: boolean,
  playbackRate: number,
  progressInterval: number
}

export type Props = Partial<PlayerProps>

let current: Props = { }

function togglePlayerWindow(state: boolean) {
  if(playerWindow.target !== null) {
    if(state) {
      playerWindow.target.setSize(390, 220)
      const display = screen.getPrimaryDisplay()
      const windowSize = playerWindow.target.getSize()
      const windowX = display.bounds.width - windowSize[0] - windowMargin
      const windowY = display.bounds.height - windowSize[1] - windowMargin
      playerWindow.target.setPosition(windowX, windowY)
      playerWindow.target.show()
    } else {
      playerWindow.target.hide()
    }
  }
}

function setPlayParams(params: Props) {
  current = {
    ...current,
    ...params
  }
  sendMessage('update_props', current)
}

export const player = (event: Electron.IpcMainInvokeEvent, payload: ExtensionPayload) => {
  switch(payload.action) {
    case 'togglePlayerWindow':
      const state = payload.payload as boolean
      togglePlayerWindow(state)
    break
    case 'setParams':
      setPlayParams(payload.payload)
    break
  }
}

export const playerComponent = (event: Electron.IpcMainInvokeEvent, payload: ExtensionPayload) => {
  switch(payload.action) {
    case 'event':
      console.log(payload.payload)
    break
  }
}
