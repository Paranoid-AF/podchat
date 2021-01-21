import path from 'path'
import fs from 'fs'
import { updateExtensionList } from './listener'
import { runInVM } from './runner'
import type { PopupMessage } from '../../windows/main'
import { sender as senderInit } from 'ipc-promise-invoke'

export const extensions: Array<ExtensionInfo> = []
export const sources: Array<SourceInfo> = []
const [ send, disband ] = senderInit(process)

const extensionReady = () => {
  send('extensionReady')
}

export const getExtensionMeta = (packagePath: string, type: ExtensionType) => {
  const packageJsonPath = path.join(packagePath, './package.json')
  let packageJsonRaw = ''
  try {
    packageJsonRaw = fs.readFileSync(packageJsonPath, { encoding: 'utf8' })
  } catch (e) {
    throw new Error("No meta data file detected.")
  }
  const packageJson = JSON.parse(packageJsonRaw)
  const extensionMeta: ExtensionInfo = {
    id: packageJson['name'],
    name: packageJson['displayName'] || packageJson['name'],
    version: packageJson['version'],
    file: packagePath,
    entry: packageJson['main'] || 'index.js',
    type
  }
  for(let key in extensionMeta) {
    if(typeof extensionMeta[key as keyof typeof extensionMeta] !== 'string') {
      throw new Error("Missing required meta key: " + key)
    }
  }
  if(packageJson['author']) {
    extensionMeta.author = packageJson['author']
  }
  if(packageJson['description']) {
    extensionMeta.description = packageJson['description']
  }
  if(packageJson['homepage']) {
    extensionMeta.homepage = packageJson['homepage']
  }
  return extensionMeta
}

export const listExtensions = (extensionDirPath: string) => {
  let fileList: Array<string> = []
  try {
    fileList = fs.readdirSync(extensionDirPath)
    fileList = fileList.filter((packageName) => {
      // Check if the directory is a valid extension directory.
      const dirPath = path.join(extensionDirPath, './' + packageName)
      const isDirectory = fs.lstatSync(dirPath).isDirectory()
      const hasMetaData = fs.existsSync(path.join(dirPath, './package.json'))
      return isDirectory && hasMetaData
    })
    // Provide full path.
    fileList.forEach((packageName, index, arr) => {
      arr[index] = path.join(extensionDirPath, './' + packageName)
    })
  } catch (e) {
    send('popup', {
      icon: 'error',
      content: 'Unable to read extension directory.'
    } as PopupMessage)
    console.error(e)
  }
  return fileList
}

export const loadExtension = (packagePath: string, type: ExtensionType) => {
  try {
    const extensionInfo = getExtensionMeta(packagePath, type)
    const extensionEntry = path.join(packagePath, './' + extensionInfo.entry)
    runInVM(extensionEntry, extensionInfo)
    extensions.push(extensionInfo)
    updateExtensionList()
  } catch (e) {
    send('popup', {
      icon: 'error',
      content: 'Unable to read extension: ' +  packagePath
    } as PopupMessage)
    console.error(e)
  }
}

const externalExtensionPath = path.join(process.env.appPath || process.cwd(), './extensions')
const folderExists = fs.existsSync(externalExtensionPath) && fs.lstatSync(externalExtensionPath).isDirectory()
if(!folderExists) {
  fs.mkdirSync(externalExtensionPath)
}
const internalExtensionPath = path.join(__dirname, '../../assets/extensions')

const externalExtensionNames = listExtensions(externalExtensionPath)
const internalExtensionNames = listExtensions(internalExtensionPath)

const extensionList: Array<{
  name: string,
  type: ExtensionType
}> = [
  ...externalExtensionNames.map(val => {
    return {
      name: val,
      type: 'EXTERNAL' as ExtensionType
    }
  }),
  ...internalExtensionNames.map(val => {
    return {
      name: val,
      type: 'INTERNAL' as ExtensionType
    }
  })
]


if(extensionList.length === 0) {
  extensionReady()
}

extensionList.forEach((packageInfo, index, arr) => {
  loadExtension(
    packageInfo.name,
    packageInfo.type
  )
  if(arr.length - 1 <= index) {
    extensionReady()
  }
})

export interface ExtensionInfo {
  id: string,
  name: string,
  version: string,
  file: string,
  entry: string,
  description?: string,
  author?: string,
  homepage?: string,
  type: 'INTERNAL' | 'EXTERNAL'
}

export interface SourceInfo {
  id: string,
  name: string,
  description?: string,
  preForm: () => Promise<Array<FormItem>>,
  postForm: (data: Record<string, any>) => string, // Key is form item ID, while value is value. Returns a token to fetch content.
  provider: string
}

interface FormField {
  description: string, // Name for display.
  value: any // Actual values that's passed
}

interface FormItem {
  id: string,
  name: string,
  type: 'SELECT' | 'INPUT' | 'RADIO' | 'CHECK',
  field?: Array<FormField> // Field could be undefined when type is INPUT
}

type ExtensionType = 'INTERNAL' | 'EXTERNAL'