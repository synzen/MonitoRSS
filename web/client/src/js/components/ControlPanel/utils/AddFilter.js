import React, { Component } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { connect } from 'react-redux'
import { Button, Input, Dropdown } from 'semantic-ui-react'
import axios from 'axios'
import toast from './toast'

const mapStateToProps = state => {
  return {
    csrfToken: state.csrfToken
  }
}

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

class AddFilter extends Component {
  constructor () {
    super()
    this.state = {
      addFilterType: 'title',
      addFilterTerm: '',
      options: [{ text: 'Title', value: 'title' }, { text: 'Description', value: 'description' }, { text: 'Summary', value: 'summary' }, { text: 'Author', value: 'author' }, { text: 'Tags', value: 'tags' }]
    }
  }

  addFilter = () => {
    const { addApiUrl, csrfToken } = this.props
    if (!this.state.addFilterType || !this.state.addFilterTerm) return
    this.setState({ adding: true })
    const payload = { type: this.state.addFilterType, term: this.state.addFilterTerm }
    axios.put(addApiUrl, payload, { headers: { 'CSRF-Token': csrfToken } })
    .then(() => {
      toast.success(`Added new filter ${this.state.addFilterTerm} to ${this.state.addFilterType}`)
      this.setState({ adding: false, addFilterTerm: '' })
    }).catch(err => {
      this.setState({ adding: false })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to add filter<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  onCustomAddition = (e, { value }) => {
    if (!value.startsWith('raw:')) return toast.error('Only custom filter types that begin with raw: are accepted!')
    this.setState({ options: [{ text: value, value }, ...this.state.options] })
  }

  render () {

    return (
        <AddFilterContainer>
          <div>
            <Dropdown search allowAdditions selection value={this.state.addFilterType} options={this.state.options} onChange={(e, data) => this.setState({ addFilterType: data.value })} onAddItem={this.onCustomAddition} />
            <Input placeholder='Enter a phrase' value={this.state.addFilterTerm} onChange={e => this.setState({ addFilterTerm: e.target.value })} onKeyPress={e => e.key === 'Enter' ? this.addFilter() : null} />
          </div>
          <FlexRight><Button disabled={this.state.adding || !this.state.addFilterType || !this.state.addFilterTerm} content='Add' color='green' onClick={this.addFilter} /></FlexRight>
        </AddFilterContainer>
    )
  }
}

AddFilter.propTypes = {
  addApiUrl: PropTypes.string
}

export default connect(mapStateToProps)(AddFilter)
