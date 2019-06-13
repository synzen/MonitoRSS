import React from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'
const SectionWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`

const SectionInner = styled.section`
  max-width: 1400px;
  width: 100%;
  text-align: center;
  padding: 60px 30px;
  > h2 {
    margin-bottom: 12px;
    font-size: 26px;
    line-height: 34px;
  }
  > p {
    margin-bottom: 50px;
    line-height: 30px;
    font-size: 18px;
  }
`

function Section (props) {
  return (
    <SectionWrapper>
      <SectionInner style={{ ...props.style }}>
        {props.children}
      </SectionInner>
    </SectionWrapper>
  )
}

Section.propTypes = {
  children: PropTypes.node,
  style: PropTypes.object
}

export default Section
