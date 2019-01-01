// Connect the router with Redux with withRouter, since by default Redux implements
// shouldComponentUpdate and has no awareness of when router updates the state
import { Switch, Route, withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { testAction } from '../actions/index-actions.js'
import React from 'react'
import PropTypes from 'prop-types'

const ComponentOne = () => {
  return (<p>ComponentOne</p>)
}

const ComponentTwo = () => {
  return (<p>ComponentTwo</p>)
}

const ComponentThree = () => {
  return (<p>ComponentDefault</p>)
}

const mapStateToProps = (state, ownProps) => {
  return { text: state.testVal }
}

const mapDispatchToProps = dispatch => {
  return {
    updateText: text => dispatch(testAction(text))
  }
}

const Dashboard = props => (
  <main>
    <h1>Dashboard Component</h1>
    <Switch>
      <Route exact path='/' component={ComponentOne} />
      <Route exact path='/two' component={ComponentTwo} />
      <Route component={ComponentThree} />
    </Switch>
    <p>
      Redux State Var:
      <br />
      {props.text}
    </p>
  </main>
)

Dashboard.propTypes = {
  text: PropTypes.string
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Dashboard))
