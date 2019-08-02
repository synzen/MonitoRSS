import React from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'

const Container = styled.div`
  padding-bottom: 2em;
  h2 {
    color: white;
    font-weight: 500;
    font-size: 28px;
  }
  p {
    font-size: 20px;
    font-weight: 400;
    color: #b9bbbe;
  }
`

class PageHeader extends React.PureComponent {
  render () {
    return (
      <Container {...this.props}>
        {this.props.heading ? <h2>{this.props.heading}</h2> : null}
        {this.props.subheading ? <p>{this.props.subheading}</p> : null}
        {this.props.children}
      </Container>
    )
  }
}

PageHeader.propTypes = {
  heading: PropTypes.string,
  subheading: PropTypes.string,
  children: PropTypes.node
}

export default PageHeader
