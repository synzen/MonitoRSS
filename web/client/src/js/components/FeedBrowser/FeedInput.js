import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Input, Button } from 'semantic-ui-react'

class FeedBrowser extends Component {
  constructor (props) {
    super()
    this.state = {
      url: props.match.params.url ? decodeURIComponent(props.match.params.url) : ''
    }
  }

  getArticles = () => this.props.getArticles(this.state.url)

  render () {

    return (
      <Input
        fluid
        disabled={this.props.loading}
        action={<Button disabled={!this.state.url} content='Get' onClick={this.getArticles} />}
        onKeyPress={e => e.key === 'Enter' ? this.getArticles() : null}
        onChange={e => this.setState({ url: e.target.value })}
        value={this.state.url} />
    )
  }
}

FeedBrowser.propTypes = {
  match: PropTypes.object,
  location: PropTypes.object,
  getArticles: PropTypes.func
}

export default withRouter(FeedBrowser)
