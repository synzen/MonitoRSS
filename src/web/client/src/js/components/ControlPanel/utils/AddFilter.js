import React, { useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Button, Input, Dropdown } from 'semantic-ui-react'
import toast from './toast'

const FlexRight = styled.div`
  display: flex;
  justify-content: flex-end;
`

const AddFilterContainer = styled.div`
  > div:first-child {
    display: flex;
    justify-content: center;
    flex-direction: column;
    .ui.input {
      margin-top: 1em;
      flex-grow: 1;
    }
    @media only screen and (min-width: 540px) {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      .ui.input {
        margin-top: 0em;
        margin-left: 1em;
      }
    }
  }
  .ui.button {
    margin-top: 1.5em;
  }
`

function AddFilter (props) {
  const [type, setType] = useState('title')
  const [value, setValue] = useState('')
  const [options, setOptions] = useState([{
    text: 'Title',
    value: 'title'
  }, {
    text: 'Description',
    value: 'description'
  }, {
    text: 'Summary',
    value: 'summary'
  }, {
    text: 'Author',
    value: 'author'
  }, {
    text: 'Tags',
    value: 'tags'
  }])
  const { addFilter, inProgress } = props

  const onCustomAddition = (e, { value }) => {
    if (!value.startsWith('raw:')) {
      return toast.error('Only custom filter types that begin with raw: are accepted!')
    }
    setOptions([{
      text: value,
      value
    }, ...options])
  }

  async function callAdd (type, value) {
    await addFilter(type, value)
    setValue('')
  }

  return (
    <AddFilterContainer>
      <div>
        <Dropdown search allowAdditions selection value={type} options={options} onChange={(e, data) => setType(data.value)} onAddItem={onCustomAddition} />
        <Input placeholder='Enter a phrase' value={value} onChange={e => setValue(e.target.value)} onKeyPress={e => e.key === 'Enter' ? callAdd(type, value) : null} />
      </div>
      <FlexRight><Button disabled={inProgress || !type || !value} content='Add' color='green' onClick={() => callAdd(type, value)} /></FlexRight>
    </AddFilterContainer>
  )
}

AddFilter.propTypes = {
  addFilter: PropTypes.func,
  inProgress: PropTypes.bool
}

export default AddFilter
