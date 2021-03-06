import path from 'path'
import { sources, ExtensionInfo, SourceInfo, readIconFile, SourceResult } from '.'
import { updateSourceList } from './listener'

export class ExtensionKit {
  extensionInfo: ExtensionInfo

  constructor(extensionInfo: ExtensionInfo) {
    this.extensionInfo = extensionInfo
  }

  getLocale() {
    return process.env.locale
  }

  registerSource(sourceInfo: SourceInfo) {
    if(sourceInfo['icon']) {
      const fileBase = this.extensionInfo.file
      sourceInfo['icon'] = readIconFile(path.join(fileBase, sourceInfo['icon']))
    }
    const originalSourceInfo = sourceInfo['postForm']
    sourceInfo['postForm'] = (async (data: Record<string, any>) => {
      const originalResult = await originalSourceInfo(data)
      return {
        ...originalResult,
        params: data
      } as SourceResult
    }) as (typeof originalSourceInfo)
    sources.push({...sourceInfo, provider: this.extensionInfo.id})
    updateSourceList()
  }

}