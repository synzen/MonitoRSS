import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import { testAction } from '../actions/index-actions.js'
import React from 'react'
import PropTypes from 'prop-types'
// import update from 'immutability-helper'

const mapStateToProps = (state) => {
  return {
    text: state.testVal
  }
}

const mapDispatchToDrops = dispatch => {
  return {
    modifyTestVar: content => dispatch(testAction(content))
  }
}

const Header = props => (
  <div>
    <h1>Header Component</h1>
    <p><Link to='/'>Dashboard /</Link></p>
    <p><Link to='/two'>Dashboard /two</Link></p>
    <p><Link to='/unknown'>Dashboard /unknown</Link></p>
    <button onClick={() => {
      props.modifyTestVar(props.text + ' 1 ')
    }}>Update Redux State</button>
  </div>
)

Header.propTypes = {
  modifyTestVar: PropTypes.func,
  text: PropTypes.string
}

export default connect(mapStateToProps, mapDispatchToDrops)(Header)
