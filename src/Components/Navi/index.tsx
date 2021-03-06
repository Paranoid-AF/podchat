import React from 'react'
import { RouteComponentProps, withRouter } from 'react-router-dom'
import './index.less'
import { RootState, Dispatch } from'../../common/rematch'
import Panel, { ItemList, SortResult } from './Panel'
import { connect } from 'react-redux'
import { generateURL, parseURL } from '../../common/utils/detail-url'
import { routes } from '../../Routes/navi'

function mapProps(props: StateProps['tabs']['pinned'] | StateProps['tabs']['regular']) {
  return props.map(item => ({
    key: item.uuid,
    name: item.title,
    color: item.cover_color || '#888',
    image: item.cover_pic || undefined
  } as ItemList))
}

class Navi extends React.PureComponent<StateProps & DispatchProps & RouteComponentProps> {
  state = {
    borderless: false,
    regularTabs: [] as Array<ItemList>,
    pinnedTabs: [] as Array<ItemList>
  }
  nextListRegular: Array<ItemList> | null = null
  nextListPinned: Array<ItemList> | null = null

  static getDerivedStateFromProps(props: StateProps) {
    return {
      regularTabs: mapProps(props.tabs.regular),
      pinnedTabs: mapProps(props.tabs.pinned)
    }
  }

  componentDidMount() {
    this.props.initPinnedTabs()
  }

  handleTabSortStart = () => {
    if(this.props.toggleCoverTransparency) {
      this.props.toggleCoverTransparency(true)
    }
  }

  handleRegularTabsPanelSort = (newList: Array<ItemList>) => {
    this.nextListRegular = newList
  }

  handleRegularTabsSortDone = (result: SortResult) => {
    if(this.props.toggleCoverTransparency) {
      this.props.toggleCoverTransparency(false)
    }
    if(this.nextListRegular !== null) {
      this.props.swapRegularTabs({
        uuidFrom: this.state.regularTabs[result.fromIndex]['key'],
        uuidTo: this.state.regularTabs[result.toIndex]['key']
      })
    }
  }

  handlePinnedTabsPanelSort = (newList: Array<ItemList>) => {
    this.nextListPinned = newList
  }

  handlePinnedTabsSortDone = (result: SortResult) => {
    if(this.props.toggleCoverTransparency) {
      this.props.toggleCoverTransparency(false)
    }
    if(this.nextListPinned !== null) {
      this.props.swapPinnedTabs({
        uuidFrom: this.state.pinnedTabs[result.fromIndex]['key'],
        uuidTo: this.state.pinnedTabs[result.toIndex]['key']
      })
    }
  }


  handleRoutesClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, key: string) => {
    for(let i=0; i<routes.length; i++) {
      if(routes[i].key === key) {
        this.props.history.push(routes[i].link)
        break
      }
    }
  }

  handleTabClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, key: string) => {
    const targetURL = generateURL({ id: key })
    this.props.history.push(targetURL)
  }

  handleCloseRegularTab = (key: string) => {
    this.props.closeTab({
      type: 'regular',
      uuid: key
    })
  }

  renderControl = () => {
    if(this.props.contentPlaying.ready) {
      return (
        <div className="control-navi-container">
          <div className="control-gradient"></div>
        </div>
      )
    } else {
      return null
    }
  }

  render() {
    let currentItemKey = ''
    for(let i=0; i<routes.length; i++) {
      if(routes[i].link === this.props.location.pathname) {
        currentItemKey = routes[i].key
        break
      }
    }
    if(currentItemKey === '') {
      const { regularTabs } = this.state
      for(let i=0; i<regularTabs.length; i++) {
        const urlInfo = parseURL(this.props.location)
        if(urlInfo && urlInfo.id === regularTabs[i].key) {
          currentItemKey = regularTabs[i].key
          break
        }
      }
    }
    if(currentItemKey === '') {
      const { pinnedTabs } = this.state
      for(let i=0; i<pinnedTabs.length; i++) {
        const urlInfo = parseURL(this.props.location)
        if(urlInfo && urlInfo.id === pinnedTabs[i].key) {
          currentItemKey = pinnedTabs[i].key
          break
        }
      }
    }
    let naviClassName = 'navi'
    if(this.props.isNowPlaying) {
      naviClassName += ' no-drag'
    }
    if(this.props.contentPlaying.ready) {
      naviClassName += ' play'
    }
    return (
      <div className={naviClassName} >
        <Panel
          items={routes}
          current={currentItemKey}
          onClick={this.handleRoutesClick}
        />
        <Panel
          items={this.state.pinnedTabs}
          current={currentItemKey}
          onClick={this.handleTabClick}
          withDivider={this.state.pinnedTabs.length > 0}
          onSort={this.handlePinnedTabsPanelSort}
          onSortStart={this.handleTabSortStart}
          onSortDone={this.handlePinnedTabsSortDone}
        />
        <Panel
          items={this.state.regularTabs}
          current={currentItemKey}
          onSort={this.handleRegularTabsPanelSort}
          onSortStart={this.handleTabSortStart}
          onSortDone={this.handleRegularTabsSortDone}
          onClick={this.handleTabClick}
          onClose={this.handleCloseRegularTab}
          withDivider={false}
        />
        {this.renderControl()}
      </div>
    )
  }
}

const mapState = (state: RootState) => ({
  contentPlaying: state.player.playing,
  tabs: state.app.tabs,
  isNowPlaying: state.player.showNowPlaying
})

const mapDispatch = (dispatch: Dispatch) => ({
  toggleCoverTransparency: dispatch.player.toggleCoverTransparency,
  swapRegularTabs: dispatch.app.swapRegularTabs,
  swapPinnedTabs: dispatch.app.swapPinnedTabs,
  initPinnedTabs: dispatch.subscription.initPinnedTabs,
  closeTab: dispatch.app.removeTab
})

type StateProps = ReturnType<typeof mapState>
type DispatchProps = ReturnType<typeof mapDispatch>

export default connect(mapState, mapDispatch)(withRouter(Navi))