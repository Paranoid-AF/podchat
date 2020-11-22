import { BrowserWindow } from 'electron'
import windowConf from './config'
import path from 'path'
import isDev from 'electron-is-dev'
import { Window } from './window'

var win: Window = {
  target: null
}

export const initMainWindow = () => {
  win.target = new BrowserWindow(windowConf)
  if(win.target === null) {
    return
  }
  if(isDev){
    win.target.loadURL(`http://localhost:3000/`)
  }else{
    win.target.loadFile(path.join(__dirname, '../../build/index.html'))
  }
  win.target.on('ready-to-show', () => {
    if(win.target !== null) {
      win.target.show()
      win.target.setSize(800, 600) // Set this to make the window always resizable on Linux.
    }
  })
  win.target.on('closed', () => {
    if(win.target !== null) {
      win.target.destroy()
    }
  })
}

export const sendPopupMessage = (msg: PopupMessage) => {
  if(win.target) {
    win.target.webContents.once('dom-ready', () => {
      if(win.target) {
        win.target.webContents.send('message', msg)
      }
    })
    win.target.webContents.send('message', msg)
  }
}

export interface PopupMessage {
  icon: 'info' | 'success' | 'warning' | 'normal' | 'error',
  content: string
}

export default win