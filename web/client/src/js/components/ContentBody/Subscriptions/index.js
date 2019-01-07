import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from '../../../actions/index-actions'
import pages from '../../../constants/pages'
import PropTypes from 'prop-types'

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.SUBSCRIPTIONS))
  }
}

class Subscriptions extends Component {
  constructor () {
    super()
    this.state = {

    }
  }

  componentWillMount () {
    this.props.setToThisPage()
  }

  render () {
    return (
      <p>Subscriptions page</p>
    )
  }
}

Subscriptions.propTypes = {
  setToThisPage: PropTypes.func
}

export default withRouter(connect(null, mapDispatchToProps)(Subscriptions))
